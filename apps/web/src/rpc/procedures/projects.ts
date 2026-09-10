import { ORPCError, os } from "@orpc/server";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/lib/db.ts";
import { isReservedProjectSlug } from "#/lib/slug.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import {
	afterCursor,
	pageCursor,
	paginate,
	slugForNewProject,
	uniqueProjectSlug,
} from "#/rpc/scope.ts";
import { projects } from "#/schemas/db/projects.ts";
import {
	ProjectCreateInput,
	ProjectGetBySlugInput,
	ProjectListInput,
	ProjectUpdateInput,
} from "#/schemas/schema.ts";

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
		const desired = slugForNewProject(input.name, input.slug);
		if (isReservedProjectSlug(desired)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Slug "${desired}" is reserved`,
			});
		}
		const slug = await uniqueProjectSlug(user.id, desired);
		const id = crypto.randomUUID();
		const [row] = await db
			.insert(projects)
			.values({
				createdBy: user.id,
				description: input.description ?? null,
				id,
				name: input.name,
				slug,
				status: input.status ?? "active",
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
		if (input.description !== undefined) {
			patch.description = input.description ?? null;
		}
		if (input.status !== undefined) {
			patch.status = input.status;
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
