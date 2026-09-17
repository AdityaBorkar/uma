import { MachineFrameSchema, type ServerFrame } from "@uma/orpc-contract";

import { MIN_CLI_VERSION } from "./config.ts";
import { appendTaskLog, finishTask, recordHeartbeat } from "./service.ts";

/**
 * Validate + dispatch one inbound machine→server frame.
 * Unknown `t` is logged + ignored (never throws) per the frozen v1 policy.
 * Returns an optional server→machine reply (today: UPGRADE_REQUIRED only).
 */
export async function handleMachineFrame(
	machineId: string,
	userId: string,
	raw: unknown,
): Promise<ServerFrame | null> {
	if (typeof raw !== "object" || raw === null) return null;
	const rec = raw as Record<string, unknown>;
	// Never trust the frame's own machineId: the session owns the identity.
	if (rec.machineId !== undefined && rec.machineId !== machineId) {
		console.warn("warn: machine frame with mismatched machineId ignored");
		return null;
	}
	const t = rec.t;
	if (
		t !== "heartbeat" &&
		t !== "log" &&
		t !== "task-done" &&
		t !== "check-ack" &&
		t !== "reset-ack" &&
		t !== "sync-ack" &&
		t !== "claim-ack" &&
		t !== "quota-exceeded"
	) {
		console.warn(
			`warn: unknown machine frame ignored: ${JSON.stringify(raw).slice(0, 200)}`,
		);
		return null;
	}
	const parsed = MachineFrameSchema.safeParse(raw);
	if (!parsed.success) {
		console.warn(
			`warn: invalid machine frame ignored: ${parsed.error.issues[0]?.message ?? "schema"}`,
		);
		return null;
	}
	const f = parsed.data;
	switch (f.t) {
		case "heartbeat": {
			const rec = await recordHeartbeat({
				cliVersion: f.cliVersion,
				cpu: f.metrics.cpu,
				disk: f.metrics.disk,
				machineId,
				quotaRunning: f.quotaUsage.running,
				quotaTotal: f.quotaUsage.total,
				ram: f.metrics.ram,
				sandboxes: f.sandboxes.map((s) => ({
					id: s.id,
					status: s.status,
					taskId: s.taskId,
				})),
				scopeHint: f.scopeHint,
				userId,
			});
			if (rec.upgradeRequired) {
				return {
					minVersion: MIN_CLI_VERSION,
					reason: "major mismatch",
					t: "UPGRADE_REQUIRED",
				};
			}
			return null;
		}
		case "log": {
			await appendTaskLog(
				f.taskId,
				machineId,
				f.stream ?? "stdout",
				f.chunk,
			).catch(() => undefined);
			return null;
		}
		case "task-done": {
			await finishTask(taskIdOf(f.taskId), userId, f.status, f.result).catch(
				() => undefined,
			);
			return null;
		}
		case "check-ack":
		case "reset-ack":
		case "sync-ack":
		case "claim-ack":
		case "quota-exceeded": {
			// Acks are recorded implicitly; receipts persist via reset-ack
			// handling when config convergence lands server-side.
			return null;
		}
	}
}

function taskIdOf(taskId: string): string {
	return taskId;
}
