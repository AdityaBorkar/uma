import { HEARTBEAT_RETENTION_DAYS, needsUpgrade } from "@uma/orpc-contract";
import { and, desc, eq, lt, ne, sql } from "drizzle-orm";

import { db } from "../db/client.ts";
import {
	machineHeartbeats,
	machineSandboxes,
	machines,
} from "../db/machines.ts";
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
		// Guarded: a revoked machine must never flip back to `connected`
		// when a stale token beats revocation by milliseconds.
		await tx
			.update(machines)
			.set({
				cliVersion: h.cliVersion,
				lastSeenAt: now,
				status: "connected",
				updatedAt: now,
			})
			.where(and(eq(machines.id, h.machineId), ne(machines.status, "revoked")));
		if (h.sandboxes.length > 0) {
			await tx
				.insert(machineSandboxes)
				.values(
					h.sandboxes.map((sb) => ({
						machineId: h.machineId,
						projectId: null,
						sandboxId: sb.id,
						status: sb.status,
						taskId: sb.taskId,
					})),
				)
				.onConflictDoUpdate({
					set: {
						machineId: h.machineId,
						status: sql`excluded.status`,
						taskId: sql`excluded.task_id`,
					},
					target: machineSandboxes.sandboxId,
				});
		}
	});
	// Best-effort retention prune, sampled: every heartbeat paying a full
	// range delete is write amplification at 5s cadence × N machines.
	if (Math.random() < 0.02) {
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
	}
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

export async function sandboxList(machineId: string, userId: string) {
	const rows = await db
		.select({ sandbox: machineSandboxes })
		.from(machineSandboxes)
		.innerJoin(machines, eq(machines.id, machineSandboxes.machineId))
		.where(
			and(
				eq(machineSandboxes.machineId, machineId),
				eq(machines.userId, userId),
			),
		);
	return rows.map((r) => r.sandbox);
}

/** Serialize heartbeat rows (Date → ISO) once for every RPC caller. */
export function serializeHeartbeats<
	T extends { createdAt: unknown; ts: unknown },
>(
	rows: T[],
): (Omit<T, "createdAt" | "ts"> & { createdAt: string; ts: string })[] {
	return rows.map((r) => ({
		...r,
		createdAt:
			r.createdAt instanceof Date
				? r.createdAt.toISOString()
				: String(r.createdAt),
		ts: r.ts instanceof Date ? r.ts.toISOString() : String(r.ts),
	}));
}

/** Mark a machine `connected` on WS open (lastSeenAt stamps on heartbeat). */
export async function markConnected(machineId: string): Promise<void> {
	await db
		.update(machines)
		.set({ status: "connected", updatedAt: new Date() })
		.where(and(eq(machines.id, machineId), ne(machines.status, "revoked")));
}

/** Mark machines with no live socket `connected → disconnected` (reaper). */
export async function markDisconnected(machineId: string): Promise<void> {
	if (isMachineConnected(machineId)) return;
	await db
		.update(machines)
		.set({ status: "disconnected", updatedAt: new Date() })
		.where(and(eq(machines.id, machineId), eq(machines.status, "connected")));
}
