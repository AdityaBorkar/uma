import { ORPCError, os } from "@orpc/server";
import { and, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/lib/db.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import {
	afterCursor,
	assertProjectOwned,
	assertSignalOwned,
	pageCursor,
	paginate,
} from "#/rpc/scope.ts";
import { projects } from "#/schemas/db/projects.ts";
import { signals, tasks } from "#/schemas/db/tasks.ts";
import {
	TaskCreateInput,
	TaskListInput,
	TaskUpdateStatusInput,
} from "#/schemas/schema.ts";

// TASK-4 transition map (docs/CONTEXT.md (Signal/Task) §5.2).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
	cancelled: [],
	completed: [],
	failed: ["queued"], // retry
	queued: ["running", "cancelled"],
	running: ["completed", "failed", "cancelled"],
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export const list = os
	.input(TaskListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		const status = input?.status;
		const projectId = input?.projectId;
		const limit = input?.limit ?? 20;

		const conditions: SQL[] = [eq(tasks.userId, user.id)];
		if (status) {
			conditions.push(eq(tasks.status, status));
		}
		if (projectId) {
			conditions.push(eq(tasks.projectId, projectId));
		}
		if (q) {
			conditions.push(ilike(tasks.title, `%${q}%`));
		}

		const cursor = await pageCursor(input?.cursor, async (id) => {
			const [row] = await db
				.select({ queuedAt: tasks.queuedAt })
				.from(tasks)
				.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
				.limit(1);
			return row?.queuedAt;
		});

		const rows = await db
			.select({
				agent: tasks.agent,
				createdAt: tasks.createdAt,
				finishedAt: tasks.finishedAt,
				id: tasks.id,
				projectId: tasks.projectId,
				projectName: projects.name,
				prompt: tasks.prompt,
				queuedAt: tasks.queuedAt,
				signalId: tasks.signalId,
				signalTitle: signals.title,
				startedAt: tasks.startedAt,
				status: tasks.status,
				title: tasks.title,
				updatedAt: tasks.updatedAt,
			})
			.from(tasks)
			.leftJoin(signals, eq(tasks.signalId, signals.id))
			.leftJoin(projects, eq(tasks.projectId, projects.id))
			.where(
				and(
					...conditions,
					cursor ? afterCursor(tasks.queuedAt, tasks.id, cursor) : undefined,
				),
			)
			.orderBy(desc(tasks.queuedAt), desc(tasks.id))
			.limit(limit + 1);

		const { items, nextCursor } = paginate(rows, limit, (last) => last.id);
		return { items, nextCursor };
	});

export const stats = os
	.input(z.object({ projectId: z.string().optional() }).optional())
	.handler(async ({ context, input }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const conditions: SQL[] = [eq(tasks.userId, user.id)];
		if (input?.projectId) {
			conditions.push(eq(tasks.projectId, input.projectId));
		}
		const rows = await db
			.select({ count: sql<number>`count(*)::int`, status: tasks.status })
			.from(tasks)
			.where(and(...conditions))
			.groupBy(tasks.status);
		const byStatus = new Map(rows.map((r) => [r.status, r.count]));
		return {
			cancelled: byStatus.get("cancelled") ?? 0,
			completed: byStatus.get("completed") ?? 0,
			failed: byStatus.get("failed") ?? 0,
			queued: byStatus.get("queued") ?? 0,
			running: byStatus.get("running") ?? 0,
		};
	});

export const get = os
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [row] = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, input.id), eq(tasks.userId, user.id)))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Task not found" });
		}
		return row;
	});

export const create = os
	.input(TaskCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		if (input.signalId) {
			await assertSignalOwned(input.signalId, user.id);
		}
		if (input.projectId) {
			await assertProjectOwned(input.projectId, user.id);
		}
		const id = crypto.randomUUID();
		const [row] = await db
			.insert(tasks)
			.values({
				agent: "cli",
				id,
				projectId: input.projectId ?? null,
				prompt: input.prompt ?? null,
				queuedAt: new Date(),
				signalId: input.signalId ?? null,
				status: "queued",
				title: input.title,
				userId: user.id,
			})
			.returning();
		if (!row) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
		return row;
	});

export const updateStatus = os
	.input(TaskUpdateStatusInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const [existing] = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, input.id), eq(tasks.userId, user.id)))
			.limit(1);
		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Task not found" });
		}
		if (input.status === existing.status) {
			return existing;
		}

		const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
		if (!allowed.includes(input.status)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Cannot move task from ${existing.status} to ${input.status}`,
			});
		}

		// Timestamps are server-stamped (TASK-5). The DB CHECK requires
		// finished_at to be present exactly for terminal statuses, so a retry
		// (failed → queued) must clear both stamps.
		const patch: Partial<typeof tasks.$inferInsert> = {
			status: input.status,
		};
		if (input.status === "running") {
			patch.startedAt = existing.startedAt ?? new Date();
		}
		if (TERMINAL_STATUSES.has(input.status)) {
			patch.finishedAt = new Date();
		}
		if (input.status === "queued") {
			patch.startedAt = null;
			patch.finishedAt = null;
		}

		const [updated] = await db
			.update(tasks)
			.set({ ...patch, updatedAt: new Date() })
			.where(eq(tasks.id, input.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND");
		}
		return updated;
	});
