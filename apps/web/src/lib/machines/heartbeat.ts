import { HEARTBEAT_RETENTION_DAYS, needsUpgrade } from "@uma/orpc-contract";
import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import {
	machineHeartbeats,
	machineSandboxes,
	machines,
} from "#/schemas/db/machines.ts";
import { HEARTBEAT_HISTORY_LIMIT, MIN_CLI_VERSION } from "./config.ts";
import { isMachineConnected } from "./sockets.ts";

export interface HeartbeatInput {
	cliVersion: string;
	cpu: number;
	disk: number;
	machineId: string;
	quotaRunning: number;
	quotaTotal: number;
	ram: number;
	sandboxes: { id: string; taskId: string | null; status: string }[];
	scopeHint: string | null;
	userId: string;
}

export async function recordHeartbeat(
	h: HeartbeatInput,
): Promise<{ upgradeRequired: boolean }> {
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx.insert(machineHeartbeats).values({
			cliVersion: h.cliVersion,
			cpu: h.cpu,
			disk: h.disk,
			id: crypto.randomUUID(),
			machineId: h.machineId,
			quotaRunning: h.quotaRunning,
			quotaTotal: h.quotaTotal,
			ram: h.ram,
			sandboxes: h.sandboxes,
			scopeHint: h.scopeHint,
			ts: now,
			userId: h.userId,
		});
		await tx
			.update(machines)
			.set({
				cliVersion: h.cliVersion,
				lastSeenAt: now,
				status: "connected",
				updatedAt: now,
			})
			.where(eq(machines.id, h.machineId));
		for (const sb of h.sandboxes) {
			await tx
				.insert(machineSandboxes)
				.values({
					machineId: h.machineId,
					projectId: null,
					sandboxId: sb.id,
					status: sb.status,
					taskId: sb.taskId,
				})
				.onConflictDoUpdate({
					set: { status: sb.status, taskId: sb.taskId },
					target: machineSandboxes.sandboxId,
				});
		}
	});
	// Best-effort retention prune outside the transaction.
	const cutoff = new Date(
		now.getTime() - HEARTBEAT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
	);
	await db
		.delete(machineHeartbeats)
		.where(
			and(
				eq(machineHeartbeats.machineId, h.machineId),
				lt(machineHeartbeats.ts, cutoff),
			),
		)
		.catch(() => undefined);
	return { upgradeRequired: needsUpgrade(h.cliVersion, MIN_CLI_VERSION) };
}

export async function heartbeatHistory(
	machineId: string,
	userId: string,
	limit = 100,
) {
	const rows = await db
		.select()
		.from(machineHeartbeats)
		.where(
			and(
				eq(machineHeartbeats.machineId, machineId),
				eq(machineHeartbeats.userId, userId),
			),
		)
		.orderBy(desc(machineHeartbeats.ts))
		.limit(Math.min(limit, HEARTBEAT_HISTORY_LIMIT));
	return rows;
}

export async function sandboxList(machineId: string) {
	return db
		.select()
		.from(machineSandboxes)
		.where(eq(machineSandboxes.machineId, machineId));
}

/** Mark a machine `connected` on WS open (lastSeenAt stamps on heartbeat). */
export async function markConnected(machineId: string): Promise<void> {
	await db
		.update(machines)
		.set({ status: "connected", updatedAt: new Date() })
		.where(eq(machines.id, machineId));
}

/** Mark machines with no live socket `connected → disconnected` (reaper). */
export async function markDisconnected(machineId: string): Promise<void> {
	if (isMachineConnected(machineId)) return;
	await db
		.update(machines)
		.set({ status: "disconnected", updatedAt: new Date() })
		.where(and(eq(machines.id, machineId), eq(machines.status, "connected")));
}
