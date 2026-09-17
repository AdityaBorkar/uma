import { ORPCError } from "@orpc/server";
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
import { authed } from "../auth.ts";
import {
	afterCursor,
	isUniqueViolation,
	mustReturn,
	pageCursor,
	paginate,
	slugForNewProject,
	toConflict,
	uniqueProjectSlug,
} from "../scope.ts";

export const list = authed
	.input(ProjectListInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const q = input?.q?.trim();
		const status = input?.status;
		const limit = input?.limit ?? 20;

		const conditions: SQL[] = [eq(projects.createdBy, userId)];
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
				.where(and(eq(projects.id, id), eq(projects.createdBy, userId)))
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

export const get = authed
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const [row] = await db
			.select()
			.from(projects)
			.where(
				and(eq(projects.id, input.id), eq(projects.createdBy, context.user.id)),
			)
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		return row;
	});

export const getBySlug = authed
	.input(ProjectGetBySlugInput)
	.handler(async ({ input, context }) => {
		const slug = input.slug.toLowerCase().trim();
		const [row] = await db
			.select()
			.from(projects)
			.where(
				and(eq(projects.slug, slug), eq(projects.createdBy, context.user.id)),
			)
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		return row;
	});

export const create = authed
	.input(ProjectCreateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		if (!input.githubRepoFullName) {
			throw new ORPCError("BAD_REQUEST", {
				message: "GitHub repository is required to create a project.",
			});
		}
		const requestedRepo = assertValidGithubRepoFullName(
			input.githubRepoFullName,
		);
		// GitHub connection is mandatory — surfaces a clear error when missing.
		const accessToken = await requireGithubAccessToken(userId);
		const repo = await fetchGithubRepo(accessToken, requestedRepo);

		const desired = slugForNewProject(input.name, input.slug);
		if (isReservedProjectSlug(desired)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Slug "${desired}" is reserved`,
			});
		}
		// Duplicate-repo check and slug allocation are independent — run together.
		const [dupRows, slug] = await Promise.all([
			db
				.select({ id: projects.id })
				.from(projects)
				.where(
					and(
						eq(projects.createdBy, userId),
						ilike(projects.githubRepoFullName, repo.fullName),
					),
				)
				.limit(1),
			uniqueProjectSlug(userId, desired),
		]);
		const duplicate = dupRows[0];
		if (duplicate) {
			throw new ORPCError("CONFLICT", {
				message: `A project for ${repo.fullName} already exists`,
			});
		}

		const id = crypto.randomUUID();
		// Description is always synced from the GitHub repository — the
		// client-supplied description is intentionally ignored.
		try {
			const [row] = await db
				.insert(projects)
				.values({
					createdBy: userId,
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
			return mustReturn(row);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict(`A project for ${repo.fullName} already exists`);
			}
			throw error;
		}
	});

export const update = authed
	.input(ProjectUpdateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const [existing] = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, input.id), eq(projects.createdBy, userId)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Project not found" });
		}
		const patch: Partial<typeof projects.$inferInsert> = {};
		if (input.name !== undefined) {
			patch.name = input.name;
		}
		// GitHub linkage changes only when a new repo is supplied. Name/slug
		// edits never hit the network — description re-sync is an explicit
		// re-link, not a side effect of renaming.
		if (input.githubRepoFullName !== undefined) {
			const requestedRepo = assertValidGithubRepoFullName(
				input.githubRepoFullName,
			);
			const accessToken = await requireGithubAccessToken(userId);
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
							eq(projects.createdBy, userId),
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
		} else if (
			!existing.githubRepoFullName &&
			input.description !== undefined
		) {
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
				patch.slug = await uniqueProjectSlug(userId, desired);
			}
		}
		if (Object.keys(patch).length === 0) {
			return existing;
		}

		try {
			const [updated] = await db
				.update(projects)
				.set({ ...patch, updatedAt: new Date() })
				.where(and(eq(projects.id, input.id), eq(projects.createdBy, userId)))
				.returning();
			return mustReturn(updated, "Project not found");
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A project with this slug or repo already exists");
			}
			throw error;
		}
	});
