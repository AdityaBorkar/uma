import { store } from "./store.ts";

// Bun.serve websocket handling: one ws per machine, Bearer session auth.
// Multiplexed v1 JSON frames. Tracks machineId -> ws for test assign injection.

const machineSockets = new Map<string, Set<unknown>>();

export function getSockets(machineId: string): Set<unknown> {
	let s = machineSockets.get(machineId);
	if (!s) {
		s = new Set();
		machineSockets.set(machineId, s);
	}
	return s;
}

export function allMachineIds(): string[] {
	return [...machineSockets.keys()];
}

export function sendToMachine(
	machineId: string,
	frame: Record<string, unknown>,
): boolean {
	const set = machineSockets.get(machineId);
	if (!set || set.size === 0) return false;
	let sent = false;
	for (const ws of set) {
		try {
			(ws as { send: (s: string) => void }).send(JSON.stringify(frame));
			sent = true;
		} catch {
			// ignore dead socket
		}
	}
	return sent;
}

export function trackSocket(machineId: string, ws: unknown): () => void {
	getSockets(machineId).add(ws);
	const m = store.machines.get(machineId);
	if (m && m.status !== "revoked") m.status = "connected";
	return () => {
		getSockets(machineId).delete(ws);
		const mm = store.machines.get(machineId);
		// Absence past grace -> connected -> disconnected (test grace: immediate on close if no sockets).
		if (mm && mm.status === "connected" && getSockets(machineId).size === 0) {
			mm.status = "disconnected";
		}
	};
}

export function handleMachineFrame(
	machineId: string,
	raw: unknown,
	send: (f: Record<string, unknown>) => void,
): void {
	const f = raw as Record<string, unknown>;
	const t = f.t as string;
	switch (t) {
		case "heartbeat": {
			const metrics = (f.metrics ?? {}) as {
				cpu?: number;
				ram?: number;
				disk?: number;
			};
			const cliVersion = String(f.cliVersion ?? "0.0.0");
			const sandboxes = Array.isArray(f.sandboxes)
				? (f.sandboxes as {
						id: string;
						taskId: string | null;
						status: string;
					}[])
				: [];
			const rec = store.recordHeartbeat({
				cliVersion,
				cpu: Number(metrics.cpu ?? 0),
				disk: Number(metrics.disk ?? 0),
				machineId,
				quotaUsage: (f.quotaUsage ?? { running: 0, total: 0 }) as {
					running: number;
					total: number;
				},
				ram: Number(metrics.ram ?? 0),
				sandboxes,
				scopeHint: (f.scopeHint as string | null) ?? null,
				ts: Date.now(),
			});
			if (rec.upgradeRequired) {
				send({
					minVersion: store.minCliVersion,
					reason: "major mismatch",
					t: "UPGRADE_REQUIRED",
				});
			}
			break;
		}
		case "log": {
			const task = store.tasks.get(String(f.taskId ?? ""));
			if (task) {
				task.logs.push({
					chunk: String(f.chunk ?? "").slice(0, 256 * 1024),
					stream: String((f.stream as string) ?? "stdout"),
					ts: Date.now(),
				});
			}
			break;
		}
		case "task-done": {
			store.finish(
				String(f.taskId ?? ""),
				(f.status as "completed" | "failed") === "completed"
					? "completed"
					: "failed",
				String(f.result ?? ""),
			);
			break;
		}
		case "check-ack":
		case "reset-ack":
		case "sync-ack":
		case "claim-ack":
		case "quota-exceeded": {
			// Acks recorded implicitly; test harness inspects via /test/* if needed.
			break;
		}
		default:
			// Unknown outbound from machine should never happen; ignore.
			break;
	}
}
