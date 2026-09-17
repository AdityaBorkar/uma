import { LOG_FRAME_CAP_BYTES } from "@uma/orpc-contract";
import { and, eq } from "drizzle-orm";

import { taskRuns } from "../db/agents.ts";
import { db } from "../db/client.ts";
import { machineSandboxes, taskLogs } from "../db/machines.ts";
import { tasks } from "../db/tasks.ts";
import { LOG_CHUNK_CAP_BYTES } from "./config.ts";

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

/**
 * Atomic claim: `queued → running` guarded by `WHERE status='queued'`.
 * Returns true on claim, false on conflict (authoritative 409 upstream).
 * The task update, sandbox mirror, and run open happen in one transaction.
 */
export async function claimTask(
	taskId: string,
	machineId: string,
	userId: string,
	sandboxId: string,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const now = new Date();
		const updated = await tx
			.update(tasks)
			.set({ startedAt: now, status: "running", updatedAt: now })
			.where(
				and(
					eq(tasks.id, taskId),
					eq(tasks.userId, userId),
					eq(tasks.status, "queued"),
				),
			)
			.returning({ agent: tasks.agent, id: tasks.id });
		if (updated.length === 0) return false;
		await tx
			.insert(machineSandboxes)
			.values({
				machineId,
				projectId: null,
				sandboxId,
				status: "running",
				taskId,
			})
			.onConflictDoUpdate({
				set: { status: "running", taskId },
				target: machineSandboxes.sandboxId,
			});
		await tx.insert(taskRuns).values({
			agent: updated[0]?.agent ?? "cli",
			id: crypto.randomUUID(),
			machineId,
			sandboxId,
			startedAt: now,
			status: "running",
			taskId,
			userId,
		});
		return true;
	});
}

export async function appendTaskLog(
	taskId: string,
	machineId: string | null,
	stream: string,
	chunk: string,
): Promise<boolean> {
	const capped =
		byteLength(chunk) > LOG_CHUNK_CAP_BYTES
			? chunk.slice(0, LOG_FRAME_CAP_BYTES)
			: chunk;
	const [t] = await db
		.select({ id: tasks.id })
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.limit(1);
	if (!t) return false;
	await db.insert(taskLogs).values({
		chunk: capped,
		id: crypto.randomUUID(),
		machineId,
		stream,
		taskId,
	});
	return true;
}

export async function finishTask(
	taskId: string,
	userId: string,
	status: "completed" | "failed",
	result?: string,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const now = new Date();
		const updated = await tx
			.update(tasks)
			.set({
				finishedAt: now,
				result: result?.slice(0, 65536) ?? null,
				status,
				updatedAt: now,
			})
			.where(
				and(
					eq(tasks.id, taskId),
					eq(tasks.userId, userId),
					eq(tasks.status, "running"),
				),
			)
			.returning({ id: tasks.id });
		if (updated.length === 0) return false;
		await tx
			.update(taskRuns)
			.set({
				finishedAt: now,
				result: result?.slice(0, 65536) ?? null,
				status,
				updatedAt: now,
			})
			.where(
				and(
					eq(taskRuns.taskId, taskId),
					eq(taskRuns.userId, userId),
					eq(taskRuns.status, "running"),
				),
			);
		return true;
	});
}
