import { and, desc, eq, type SQL, sql } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import { requireUser } from "#/rpc/auth.ts";
import { implementer } from "#/rpc/contract.ts";
import { afterCursor, pageCursor } from "#/rpc/scope.ts";
import { taskRuns } from "#/schemas/db/agents.ts";

/**
 * Task-run tracking (contract-first: `apiContract runs.*`).
 * Browser cookie auth, read-only: rows are written by the claim/finish paths
 * (`claimTask`/`finishTask` in `#/lib/machines/service.ts`) so runs can never
 * disagree with task status.
 */

export const list = implementer.runs.list.handler(
	async ({ input, context }) => {
		const user = await requireUser(context.headers);
		const limit = input?.limit ?? 20;
		const conditions: SQL[] = [eq(taskRuns.userId, user.id)];
		if (input?.taskId) conditions.push(eq(taskRuns.taskId, input.taskId));
		if (input?.machineId)
			conditions.push(eq(taskRuns.machineId, input.machineId));
		if (input?.status) conditions.push(eq(taskRuns.status, input.status));

		const cursor = await pageCursor(input?.cursor, async (id) => {
			const [row] = await db
				.select({ createdAt: taskRuns.createdAt })
				.from(taskRuns)
				.where(and(eq(taskRuns.id, id), eq(taskRuns.userId, user.id)))
				.limit(1);
			return row?.createdAt;
		});

		const rows = await db
			.select()
			.from(taskRuns)
			.where(
				and(
					...conditions,
					cursor
						? afterCursor(taskRuns.createdAt, taskRuns.id, cursor)
						: undefined,
				),
			)
			.orderBy(desc(taskRuns.createdAt), desc(taskRuns.id))
			.limit(limit + 1);

		const hasMore = rows.length > limit;
		const items = hasMore ? rows.slice(0, limit) : rows;
		const last = hasMore ? items[items.length - 1] : undefined;
		return { items, nextCursor: last?.id ?? null };
	},
);

export const get = implementer.runs.get.handler(
	async ({ input, context, errors }) => {
		const user = await requireUser(context.headers);
		const [row] = await db
			.select()
			.from(taskRuns)
			.where(and(eq(taskRuns.id, input.id), eq(taskRuns.userId, user.id)))
			.limit(1);
		if (!row) throw errors.NOT_FOUND();
		return row;
	},
);

export const stats = implementer.runs.stats.handler(
	async ({ input, context }) => {
		const user = await requireUser(context.headers);
		const conditions: SQL[] = [eq(taskRuns.userId, user.id)];
		if (input?.taskId) conditions.push(eq(taskRuns.taskId, input.taskId));
		if (input?.machineId)
			conditions.push(eq(taskRuns.machineId, input.machineId));
		const rows = await db
			.select({ count: sql<number>`count(*)::int`, status: taskRuns.status })
			.from(taskRuns)
			.where(and(...conditions))
			.groupBy(taskRuns.status);
		const byStatus = new Map(rows.map((r) => [r.status, r.count]));
		return {
			cancelled: byStatus.get("cancelled") ?? 0,
			completed: byStatus.get("completed") ?? 0,
			failed: byStatus.get("failed") ?? 0,
			running: byStatus.get("running") ?? 0,
		};
	},
);
