import { randomUUID } from "node:crypto";
import { customAlphabet } from "nanoid";
import { coerce, major, valid } from "semver";

// ---------------------------------------------------------------------------
// In-memory test store (server-central is throwaway; uma repo owns real DB).
// ---------------------------------------------------------------------------

export type MachineStatus =
	| "enrolled"
	| "connected"
	| "disconnected"
	| "revoked";

export interface Machine {
	cliVersion: string | null;
	configVersion: string;
	id: string;
	lastSeenAt: number | null;
	limits: { maxRunning?: number; maxTotal?: number } | null;
	name: string;
	status: MachineStatus;
	userId: string;
}

export interface DeviceCode {
	client_id: string;
	createdAt: number;
	device_code: string;
	expires_in: number;
	interval: number;
	machineId: string;
	machineName?: string;
	status: "pending" | "approved" | "denied";
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
}

export interface Session {
	createdAt: number;
	machineId: string;
	revoked: boolean;
	token: string;
	userId: string;
}

export type TaskStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface Task {
	branch?: string;
	commit?: string;
	finishedAt?: number;
	id: string;
	logs: { stream: string; chunk: string; ts: number }[];
	machineId?: string;
	projectId: string | null;
	prompt: string;
	repoUrl: string;
	sandboxId?: string;
	startedAt?: number;
	status: TaskStatus;
}

export interface Signal {
	createdAt: number;
	id: string;
	message: string;
	projectId: string | null;
	severity: "warning" | "critical";
	source: "manual" | "alert";
}

export interface HeartbeatRecord {
	cliVersion: string;
	cpu: number;
	disk: number;
	machineId: string;
	quotaUsage: { running: number; total: number };
	ram: number;
	sandboxes: { id: string; taskId: string | null; status: string }[];
	scopeHint: string | null;
	ts: number;
}

// Crypto-backed RNG (nanoid) over the legacy no-lookalikes alphabet
// (uppercase, no 0/1/I/L/O). Same prefixes/lengths/formats as before,
// only the entropy source changed.
const RAND_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randId = customAlphabet(RAND_ALPHABET, 32);

function rand(n = 16): string {
	return randId(n);
}

export class Store {
	machines = new Map<string, Machine>();
	machinesByName = new Map<string, string>(); // `${userId}:${name}` -> id
	devices = new Map<string, DeviceCode>(); // device_code -> rec
	devicesByUserCode = new Map<string, string>(); // user_code -> device_code
	sessions = new Map<string, Session>(); // token -> session
	tasks = new Map<string, Task>();
	signals: Signal[] = [];
	heartbeats = new Map<string, HeartbeatRecord[]>(); // machineId -> rows
	machineSandboxes = new Map<
		string,
		{ id: string; taskId: string | null; status: string }[]
	>();
	configVersions = new Map<string, string>();
	lastSignalAt = new Map<string, number>(); // scopeKey -> ts
	pressureSamples = new Map<
		string,
		{ ts: number; cpu: number; disk: number }[]
	>();
	minCliVersion = "0.1.0";

	createDevice(clientId: string, machineName?: string): DeviceCode {
		const device_code = `dev_${rand(24)}`;
		const user_code = `${rand(4)}-${rand(4)}`;
		const machineId = randomUUID();
		const base = process.env.TEST_PUBLIC_URL ?? "http://127.0.0.1:3030";
		const rec: DeviceCode = {
			client_id: clientId,
			createdAt: Date.now(),
			device_code,
			expires_in: 600,
			interval: 2,
			machineId,
			machineName,
			status: "pending",
			user_code,
			verification_uri: `${base}/device`,
			verification_uri_complete: `${base}/device?code=${user_code}`,
		};
		this.devices.set(device_code, rec);
		this.devicesByUserCode.set(user_code, device_code);
		return rec;
	}

	approveDevice(
		userCode: string,
		approve = true,
	): "ok" | "unknown" | "duplicate" {
		const dc = this.devicesByUserCode.get(userCode);
		if (!dc) return "unknown";
		const rec = this.devices.get(dc);
		if (!rec) return "unknown";
		if (!approve) {
			rec.status = "denied";
			return "ok";
		}
		// Pre-create enrolled machine (UNIQUE(userId,name) enforced).
		const userId = "test-user";
		const name = rec.machineName ?? `machine-${rec.machineId.slice(0, 8)}`;
		const key = `${userId}:${name}`;
		if (this.machinesByName.has(key)) {
			// Duplicate name: deny the grant so the poller sees access_denied.
			rec.status = "denied";
			return "duplicate";
		}
		rec.status = "approved";
		const m: Machine = {
			cliVersion: null,
			configVersion: "v1",
			id: rec.machineId,
			lastSeenAt: null,
			limits: null,
			name,
			status: "enrolled",
			userId,
		};
		this.machines.set(m.id, m);
		this.machinesByName.set(key, m.id);
		return "ok";
	}

	pollToken(
		deviceCode: string,
		clientId: string,
	):
		| { ok: true; token: string; machineId: string }
		| { ok: false; error: string } {
		const rec = this.devices.get(deviceCode);
		if (!rec) return { error: "expired_token", ok: false };
		if (rec.client_id !== clientId)
			return { error: "access_denied", ok: false };
		if (Date.now() - rec.createdAt > rec.expires_in * 1000)
			return { error: "expired_token", ok: false };
		if (rec.status === "pending")
			return { error: "authorization_pending", ok: false };
		if (rec.status === "denied") return { error: "access_denied", ok: false };
		const token = `sess_${rand(32)}`;
		this.sessions.set(token, {
			createdAt: Date.now(),
			machineId: rec.machineId,
			revoked: false,
			token,
			userId: "test-user",
		});
		return { machineId: rec.machineId, ok: true, token };
	}

	auth(token: string | null): Session | null {
		if (!token) return null;
		const s = this.sessions.get(token.replace(/^Bearer\s+/i, ""));
		if (!s || s.revoked) return null;
		return s;
	}

	revokeMachine(machineId: string): void {
		const m = this.machines.get(machineId);
		if (m) m.status = "revoked";
		for (const s of this.sessions.values()) {
			if (s.machineId === machineId) s.revoked = true;
		}
	}

	recordHeartbeat(h: HeartbeatRecord): { upgradeRequired: boolean } {
		const arr = this.heartbeats.get(h.machineId) ?? [];
		arr.push(h);
		// Keep last 5000 per machine in-memory (SQLite retention is client-side).
		if (arr.length > 5000) arr.splice(0, arr.length - 5000);
		this.heartbeats.set(h.machineId, arr);
		const m = this.machines.get(h.machineId);
		if (m) {
			m.lastSeenAt = h.ts;
			m.cliVersion = h.cliVersion;
			if (m.status !== "revoked") m.status = "connected";
		}
		this.machineSandboxes.set(h.machineId, h.sandboxes ?? []);
		// Pressure -> Signal (server-side, scoped or global, 10min cooldown).
		this.evaluatePressure(h);
		return { upgradeRequired: this.isUpgradeRequired(h.cliVersion) };
	}

	isUpgradeRequired(cliVersion: string): boolean {
		const maj = (v: string): number => {
			const t = v.trim();
			const nv = valid(t) ?? coerce(t)?.version;
			if (nv) {
				try {
					return major(nv);
				} catch {
					// fall through to naive fallback
				}
			}
			return parseInt(v.split(".")[0] ?? "0", 10) || 0;
		};
		return maj(cliVersion) < maj(this.minCliVersion);
	}

	evaluatePressure(h: HeartbeatRecord): void {
		const over = h.cpu > 90 || h.disk > 90;
		const arr = this.pressureSamples.get(h.machineId) ?? [];
		const now = h.ts;
		if (over) arr.push({ cpu: h.cpu, disk: h.disk, ts: now });
		const cutoff = now - 10 * 60 * 1000;
		const window = arr.filter((s) => s.ts >= cutoff);
		this.pressureSamples.set(h.machineId, window);
		if (!over || window.length === 0) return;
		const first = window[0];
		if (!first) return;
		const sustained = now - first.ts >= 10 * 60 * 1000;
		if (!sustained) return;
		const scopeKey = h.scopeHint ?? "__global__";
		const last = this.lastSignalAt.get(`${h.machineId}:${scopeKey}`) ?? 0;
		if (now - last < 10 * 60 * 1000) return;
		this.lastSignalAt.set(`${h.machineId}:${scopeKey}`, now);
		this.signals.push({
			createdAt: now,
			id: randomUUID(),
			message: `machine pressure cpu=${h.cpu.toFixed(1)} disk=${h.disk.toFixed(1)}`,
			projectId: h.scopeHint,
			severity: h.disk > 90 ? "critical" : "warning",
			source: "alert",
		});
	}

	queueTask(t: Omit<Task, "id" | "status" | "logs"> & { id?: string }): Task {
		const task: Task = {
			branch: t.branch,
			commit: t.commit,
			id: t.id ?? `task_${rand(8).toLowerCase()}`,
			logs: [],
			projectId: t.projectId,
			prompt: t.prompt,
			repoUrl: t.repoUrl ?? "",
			status: "queued",
		};
		this.tasks.set(task.id, task);
		return task;
	}

	claim(taskId: string, machineId: string, sandboxId: string): boolean {
		const t = this.tasks.get(taskId);
		if (!t) return false;
		if (t.status !== "queued") return false; // 409 authoritative
		t.status = "running";
		t.machineId = machineId;
		t.sandboxId = sandboxId;
		t.startedAt = Date.now();
		return true;
	}

	finish(
		taskId: string,
		status: "completed" | "failed",
		result?: string,
	): boolean {
		const t = this.tasks.get(taskId);
		if (!t) return false;
		if (t.status !== "running") return false;
		t.status = status;
		t.finishedAt = Date.now(); // terminal + finishedAt enforced
		if (result)
			t.logs.push({
				chunk: result.slice(0, 1000),
				stream: "system",
				ts: Date.now(),
			});
		return true;
	}
}

export const store = new Store();
