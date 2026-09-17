import { LOG_FRAME_CAP_BYTES } from "@uma/orpc-contract";
import { and, eq } from "drizzle-orm";

import { taskRuns } from "../db/agents.ts";
import { db } from "../db/client.ts";
import { machineSandboxes, taskLogs } from "../db/machines.ts";
import { tasks } from "../db/tasks.ts";

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

/** Truncate to a byte cap without splitting a code point. */
function truncateToBytes(s: string, cap: number): string {
	if (byteLength(s) <= cap) return s;
	const bytes = new TextEncoder().encode(s);
	let end = cap;
	// Back off over UTF-8 continuation bytes (10xxxxxx).
	while (end > 0 && (bytes[end] ?? 0) >= 0x80 && (bytes[end] ?? 0) < 0xc0) {
		end--;
	}
	return new TextDecoder().decode(bytes.slice(0, end));
}

/** Max stored task-result chars (single source of truth for both writes). */
export const RESULT_CAP_CHARS = 65536;

/** Truncate to a char cap without splitting a surrogate pair. */
function truncateToChars(s: string, cap: number): string {
	if (s.length <= cap) return s;
	return Array.from(s).slice(0, cap).join("");
}

/**
 * Atomic claim: `queued → running` guarded by `WHERE status='queued'`.
 * Returns the authoritative `startedAt` on claim, null on conflict
 * (authoritative 409 upstream). The task update, sandbox mirror, and run
 * open happen in one transaction.
 */
export async function claimTask(
	taskId: string,
	machineId: string,
	userId: string,
	sandboxId: string,
): Promise<Date | null> {
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
		if (updated.length === 0) return null;
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
		return now;
	});
}

/**
 * Append one log chunk. Ownership is checked through the session user so one
 * machine can never append to another user's task. Returns false when the
 * task is unknown or not owned (frame path ignores it, never throws).
 */
export async function appendTaskLog(
	taskId: string,
	machineId: string | null,
	stream: "stdout" | "stderr" | "system",
	chunk: string,
	userId: string,
): Promise<boolean> {
	// Single contract cap, enforced in bytes (never slice UTF-16 units).
	const capped = truncateToBytes(chunk, LOG_FRAME_CAP_BYTES);
	const [t] = await db
		.select({ id: tasks.id })
		.from(tasks)
		.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
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
				result: result ? truncateToChars(result, RESULT_CAP_CHARS) : null,
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
				result: result ? truncateToChars(result, RESULT_CAP_CHARS) : null,
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
