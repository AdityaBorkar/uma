import { ORPCError, os } from "@orpc/server";
import { KNOWN_AGENT_NAMES } from "@uma/orpc-contract";
import { and, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/lib/db.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import { implementer } from "#/rpc/contract.ts";
import {
	afterCursor,
	assertProjectOwned,
	assertSignalOwned,
	pageCursor,
	paginate,
} from "#/rpc/scope.ts";
import { agents } from "#/schemas/db/agents.ts";
import { taskLogs } from "#/schemas/db/machines.ts";
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
		if (input?.agent) {
			conditions.push(eq(tasks.agent, input.agent));
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
		// Agent pinning: `cli` is the legacy default; anything else must be a
		// well-known agent or a name in the user's registry (`agents.*`).
		const agent = input.agent?.trim() || "cli";
		if (
			agent !== "cli" &&
			!(KNOWN_AGENT_NAMES as readonly string[]).includes(agent)
		) {
			const [registered] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(and(eq(agents.userId, user.id), eq(agents.name, agent)))
				.limit(1);
			if (!registered) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Unknown agent "${agent}"`,
				});
			}
		}
		const id = crypto.randomUUID();
		const [row] = await db
			.insert(tasks)
			.values({
				agent,
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

/**
 * Browser-readable task logs (contract-first: `apiContract tasks.logs.list`).
 * Machines append via the WS `log` frame; ownership is checked through the
 * parent task.
 */
export const logsList = implementer.tasks.logs.list.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [task] = await db
			.select({ id: tasks.id })
			.from(tasks)
			.where(and(eq(tasks.id, input.taskId), eq(tasks.userId, user.id)))
			.limit(1);
		if (!task) throw errors.NOT_FOUND();
		const limit = input.limit ?? 50;
		const cursor = await pageCursor(input.cursor, async (id) => {
			const [row] = await db
				.select({ createdAt: taskLogs.createdAt })
				.from(taskLogs)
				.where(and(eq(taskLogs.id, id), eq(taskLogs.taskId, input.taskId)))
				.limit(1);
			return row?.createdAt;
		});
		const rows = await db
			.select()
			.from(taskLogs)
			.where(
				and(
					eq(taskLogs.taskId, input.taskId),
					cursor
						? afterCursor(taskLogs.createdAt, taskLogs.id, cursor)
						: undefined,
				),
			)
			.orderBy(desc(taskLogs.createdAt), desc(taskLogs.id))
			.limit(limit + 1);
		const { items, nextCursor } = paginate(rows, limit, (last) => last.id);
		return { items, nextCursor: nextCursor ?? null };
	},
);
