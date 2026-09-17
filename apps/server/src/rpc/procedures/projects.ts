import { ORPCError, os } from "@orpc/server";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
	assertValidGithubRepoFullName,
	fetchGithubRepo,
	requireGithubAccessToken,
} from "../../connections/github.ts";
import { db } from "../../db/client.ts";
import { projects } from "../../db/projects.ts";
import { isReservedProjectSlug } from "../../lib/slug.ts";
import {
	ProjectCreateInput,
	ProjectGetBySlugInput,
	ProjectListInput,
	ProjectUpdateInput,
} from "../../schemas/schema.ts";
import { type RpcContext, requireUser } from "../auth.ts";
import {
	afterCursor,
	pageCursor,
	paginate,
	slugForNewProject,
	uniqueProjectSlug,
} from "../scope.ts";

export const list = os
	.input(ProjectListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		const status = input?.status;
		const limit = input?.limit ?? 20;

		const conditions: SQL[] = [eq(projects.createdBy, user.id)];
		if (status) {
			conditions.push(eq(projects.status, status));
		}
		if (q) {
			conditions.push(ilike(projects.name, `%${q}%`));
		}

		const cursor = await pageCursor(input?.cursor, async (id) => {
			const [row] = await db
				.select({ createdAt: projects.createdAt })
				.from(projects)
				.where(and(eq(projects.id, id), eq(projects.createdBy, user.id)))
				.limit(1);
			return row?.createdAt;
		});

		const rows = await db
			.select()
			.from(projects)
			.where(
				and(
					...conditions,
					cursor
						? afterCursor(projects.createdAt, projects.id, cursor)
						: undefined,
				),
			)
			.orderBy(desc(projects.createdAt), desc(projects.id))
			.limit(limit + 1);

		const { items, nextCursor } = paginate(rows, limit, (last) => last.id);
		return { items, nextCursor };
	});

export const get = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, input.id), eq(projects.createdBy, user.id)))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		return row;
	});

export const getBySlug = os
	.input(ProjectGetBySlugInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const slug = input.slug.toLowerCase().trim();
		const [row] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.slug, slug), eq(projects.createdBy, user.id)))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		return row;
	});

export const create = os
	.input(ProjectCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		if (!input.githubRepoFullName) {
			throw new ORPCError("BAD_REQUEST", {
				message: "GitHub repository is required to create a project.",
			});
		}
		const requestedRepo = assertValidGithubRepoFullName(
			input.githubRepoFullName,
		);
		// GitHub connection is mandatory — surfaces a clear error when missing.
		const accessToken = await requireGithubAccessToken(user.id);
		const repo = await fetchGithubRepo(accessToken, requestedRepo);

		// One project per GitHub repo per user.
		const [duplicate] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.createdBy, user.id),
					ilike(projects.githubRepoFullName, repo.fullName),
				),
			)
			.limit(1);
		if (duplicate) {
			throw new ORPCError("CONFLICT", {
				message: `A project for ${repo.fullName} already exists`,
			});
		}

		const desired = slugForNewProject(input.name, input.slug);
		if (isReservedProjectSlug(desired)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Slug "${desired}" is reserved`,
			});
		}
		const slug = await uniqueProjectSlug(user.id, desired);
		const id = crypto.randomUUID();
		// Description is always synced from the GitHub repository — the
		// client-supplied description is intentionally ignored.
		const [row] = await db
			.insert(projects)
			.values({
				createdBy: user.id,
				description: repo.description ?? null,
				githubRepoFullName: repo.fullName,
				githubRepoId: String(repo.id),
				githubRepoUrl: repo.htmlUrl,
				id,
				name: input.name,
				slug,
				status: "active",
			})
			.returning();
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

export const update = os
	.input(ProjectUpdateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, input.id), eq(projects.createdBy, user.id)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		const patch: Partial<typeof projects.$inferInsert> = {};
		if (input.name !== undefined) {
			patch.name = input.name;
		}
		// GitHub linkage: prefer the newly supplied repo, otherwise keep the
		// stored one. When a repo is linked, description is always re-synced
		// from GitHub and any client-supplied description is ignored.
		const targetRepoFullName =
			input.githubRepoFullName ?? existing.githubRepoFullName;
		if (input.githubRepoFullName !== undefined) {
			const requestedRepo = assertValidGithubRepoFullName(
				input.githubRepoFullName,
			);
			const accessToken = await requireGithubAccessToken(user.id);
			const repo = await fetchGithubRepo(accessToken, requestedRepo);
			if (
				!existing.githubRepoFullName ||
				existing.githubRepoFullName.toLowerCase() !==
					repo.fullName.toLowerCase()
			) {
				const [duplicate] = await db
					.select({ id: projects.id })
					.from(projects)
					.where(
						and(
							eq(projects.createdBy, user.id),
							ilike(projects.githubRepoFullName, repo.fullName),
						),
					)
					.limit(1);
				if (duplicate && duplicate.id !== existing.id) {
					throw new ORPCError("CONFLICT", {
						message: `A project for ${repo.fullName} already exists`,
					});
				}
			}
			patch.githubRepoFullName = repo.fullName;
			patch.githubRepoId = String(repo.id);
			patch.githubRepoUrl = repo.htmlUrl;
			patch.description = repo.description ?? null;
		} else if (targetRepoFullName) {
			// Keep description in sync even when only name/slug changes.
			try {
				const accessToken = await requireGithubAccessToken(user.id);
				const repo = await fetchGithubRepo(accessToken, targetRepoFullName);
				patch.githubRepoFullName = repo.fullName;
				patch.githubRepoId = String(repo.id);
				patch.githubRepoUrl = repo.htmlUrl;
				patch.description = repo.description ?? null;
			} catch (error) {
				// If the GitHub connection is gone we still allow name/slug
				// edits, but never accept a client-supplied description as
				// the source of truth.
				if (
					error instanceof ORPCError &&
					(error.code === "NOT_FOUND" || error.code === "UNAUTHORIZED")
				) {
					// leave stored description untouched
				} else {
					throw error;
				}
			}
		} else if (input.description !== undefined) {
			// Legacy projects without GitHub linkage keep manual descriptions.
			patch.description = input.description ?? null;
		}
		if (input.slug !== undefined) {
			const desired = input.slug.trim().toLowerCase();
			if (isReservedProjectSlug(desired)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Slug "${desired}" is reserved`,
				});
			}
			if (desired !== existing.slug) {
				patch.slug = await uniqueProjectSlug(user.id, desired);
			}
		}
		if (Object.keys(patch).length === 0) {
			return existing;
		}

		const [updated] = await db
			.update(projects)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(projects.id, input.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND");
		}
		return updated;
	});
