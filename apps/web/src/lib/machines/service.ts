import {
	deviceCode,
	HEARTBEAT_RETENTION_DAYS,
	LOG_FRAME_CAP_BYTES,
	MachineNameSchema,
	needsUpgrade,
	PRESSURE_COOLDOWN_S,
	PRESSURE_SUSTAINED_S,
	PRESSURE_THRESHOLD_PCT,
	sessionToken,
	userCode,
} from "@uma/orpc-contract";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import { serverUrl } from "#/env.ts";
import { db } from "#/lib/db.ts";
import { taskRuns } from "#/schemas/db/agents.ts";
import {
	deviceCodes,
	machineHeartbeats,
	machinePressureState,
	machineSandboxes,
	machineSessions,
	machines,
	taskLogs,
} from "#/schemas/db/machines.ts";
import { projects } from "#/schemas/db/projects.ts";
import { signals, tasks } from "#/schemas/db/tasks.ts";
import {
	allowedClients,
	DEVICE_CODE_TTL_S,
	DEVICE_POLL_INTERVAL_S,
	HEARTBEAT_HISTORY_LIMIT,
	LOG_CHUNK_CAP_BYTES,
	MIN_CLI_VERSION,
} from "./config.ts";
import { isMachineConnected, sendToMachine } from "./sockets.ts";

export interface MachineSession {
	machineId: string;
	token: string;
	userId: string;
}

export function bearerToken(headers: Headers): string | null {
	const h = headers.get("authorization");
	if (!h) return null;
	const m = h.match(/^Bearer\s+(.+)$/i);
	return m?.[1]?.trim() || null;
}

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

/** Authenticate a machine Bearer token; null when unknown or revoked. */
export async function authMachine(
	token: string | null,
): Promise<(MachineSession & { name: string; status: string }) | null> {
	if (!token) return null;
	const clean = token.replace(/^Bearer\s+/i, "").trim();
	if (!clean) return null;
	const [sess] = await db
		.select()
		.from(machineSessions)
		.where(eq(machineSessions.token, clean))
		.limit(1);
	if (!sess || sess.revoked) return null;
	const [m] = await db
		.select({ name: machines.name, status: machines.status })
		.from(machines)
		.where(eq(machines.id, sess.machineId))
		.limit(1);
	if (!m || m.status === "revoked") return null;
	return {
		machineId: sess.machineId,
		name: m.name,
		status: m.status,
		token: clean,
		userId: sess.userId,
	};
}

// --- Device flow --------------------------------------------------------

export interface DeviceCodeRecord {
	device_code: string;
	expires_in: number;
	interval: number;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
}

export async function createDeviceCode(
	clientId: string,
	machineName?: string,
): Promise<
	| { ok: true; record: DeviceCodeRecord }
	| { ok: false; error: "invalid_client" | "invalid_name"; detail?: string }
> {
	if (!allowedClients().includes(clientId)) {
		return { error: "invalid_client", ok: false };
	}
	if (machineName !== undefined) {
		const v = MachineNameSchema.safeParse(machineName);
		if (!v.success) {
			return {
				detail: v.error.issues[0]?.message ?? "invalid machine name",
				error: "invalid_name",
				ok: false,
			};
		}
	}
	const machineId = crypto.randomUUID();
	const record: DeviceCodeRecord = {
		device_code: deviceCode(),
		expires_in: DEVICE_CODE_TTL_S,
		interval: DEVICE_POLL_INTERVAL_S,
		user_code: userCode(),
		verification_uri: `${serverUrl}/device`,
		verification_uri_complete: "",
	};
	record.verification_uri_complete = `${serverUrl}/device?code=${record.user_code}`;
	await db.insert(deviceCodes).values({
		clientId,
		deviceCode: record.device_code,
		expiresIn: record.expires_in,
		interval: record.interval,
		machineId,
		machineName: machineName ?? null,
		status: "pending",
		userCode: record.user_code,
	});
	return { ok: true, record };
}

export type ApproveResult = "ok" | "unknown" | "duplicate" | "denied";

/**
 * Approve (or deny) a device code as `userId`. Approval pre-creates the
 * enrolled machine; `UNIQUE(userId, name)` violations deny the grant so the
 * poller observes `access_denied` — same semantics as the test harness.
 */
export async function approveDevice(
	userId: string,
	code: string,
	approve: boolean,
): Promise<ApproveResult> {
	const [rec] = await db
		.select()
		.from(deviceCodes)
		.where(eq(deviceCodes.userCode, code))
		.limit(1);
	if (!rec) return "unknown";
	if (!approve) {
		await db
			.update(deviceCodes)
			.set({ status: "denied" })
			.where(eq(deviceCodes.deviceCode, rec.deviceCode));
		return "denied";
	}
	const name = rec.machineName ?? `machine-${rec.machineId.slice(0, 8)}`;
	const [taken] = await db
		.select({ id: machines.id })
		.from(machines)
		.where(and(eq(machines.userId, userId), eq(machines.name, name)))
		.limit(1);
	if (taken) {
		await db
			.update(deviceCodes)
			.set({ status: "denied" })
			.where(eq(deviceCodes.deviceCode, rec.deviceCode));
		return "duplicate";
	}
	await db
		.update(deviceCodes)
		.set({ status: "approved" })
		.where(eq(deviceCodes.deviceCode, rec.deviceCode));
	await db
		.insert(machines)
		.values({
			configVersion: "v1",
			id: rec.machineId,
			name,
			status: "enrolled",
			userId,
		})
		.onConflictDoNothing();
	return "ok";
}

export type PollResult =
	| { ok: true; token: string; machineId: string }
	| { ok: false; error: string };

export async function pollDeviceToken(
	device_code: string,
	client_id: string,
): Promise<PollResult> {
	const [rec] = await db
		.select()
		.from(deviceCodes)
		.where(eq(deviceCodes.deviceCode, device_code))
		.limit(1);
	if (!rec) return { error: "expired_token", ok: false };
	if (rec.clientId !== client_id) return { error: "access_denied", ok: false };
	const ageMs = Date.now() - rec.createdAt.getTime();
	if (ageMs > rec.expiresIn * 1000)
		return { error: "expired_token", ok: false };
	if (rec.status === "pending")
		return { error: "authorization_pending", ok: false };
	if (rec.status === "denied") return { error: "access_denied", ok: false };
	const token = sessionToken();
	// The approving user owns the machine row created at approval time.
	const [m] = await db
		.select({ userId: machines.userId })
		.from(machines)
		.where(eq(machines.id, rec.machineId))
		.limit(1);
	if (!m) return { error: "access_denied", ok: false };
	await db.insert(machineSessions).values({
		machineId: rec.machineId,
		token,
		userId: m.userId,
	});
	return { machineId: rec.machineId, ok: true, token };
}

export async function revokeMachine(
	userId: string,
	machineId: string,
): Promise<boolean> {
	const [m] = await db
		.select({ id: machines.id })
		.from(machines)
		.where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
		.limit(1);
	if (!m) return false;
	await db
		.update(machines)
		.set({ status: "revoked", updatedAt: new Date() })
		.where(eq(machines.id, machineId));
	await db
		.update(machineSessions)
		.set({ revoked: new Date() })
		.where(eq(machineSessions.machineId, machineId));
	return true;
}

// --- Heartbeats + pressure -------------------------------------------------

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
	await db.insert(machineHeartbeats).values({
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
	await db
		.update(machines)
		.set({
			cliVersion: h.cliVersion,
			lastSeenAt: now,
			status: "connected",
			updatedAt: now,
		})
		.where(eq(machines.id, h.machineId));
	// Mirror latest sandbox set for `sandboxList` without scanning history.
	for (const sb of h.sandboxes) {
		await db
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
	// Best-effort retention prune (30d raw heartbeats, contract constant).
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
	await evaluatePressure(h, now.getTime()).catch(() => undefined);
	return { upgradeRequired: needsUpgrade(h.cliVersion, MIN_CLI_VERSION) };
}

/**
 * Server-side pressure → Signal (scoped or global, 10min sustain + cooldown).
 * Ports the test-harness logic onto `machine_pressure_state` + `signals`.
 */
async function evaluatePressure(
	h: HeartbeatInput,
	nowMs: number,
): Promise<void> {
	const threshold = PRESSURE_THRESHOLD_PCT;
	const over = h.cpu > threshold || h.disk > threshold;
	const scopeKey = h.scopeHint ?? "__global__";
	const [row] = await db
		.select()
		.from(machinePressureState)
		.where(
			and(
				eq(machinePressureState.machineId, h.machineId),
				eq(machinePressureState.scopeKey, scopeKey),
			),
		)
		.limit(1);
	let samples = row?.samples ?? [];
	if (over) samples = [...samples, { cpu: h.cpu, disk: h.disk, ts: nowMs }];
	const cutoff = nowMs - PRESSURE_SUSTAINED_S * 1000;
	samples = samples.filter((s) => s.ts >= cutoff);
	const lastSignalAt = row?.lastSignalAt?.getTime() ?? 0;
	let shouldSignal = false;
	if (over && samples.length > 0) {
		const first = samples[0];
		const sustained =
			first !== undefined && nowMs - first.ts >= PRESSURE_SUSTAINED_S * 1000;
		const cooled = nowMs - lastSignalAt >= PRESSURE_COOLDOWN_S * 1000;
		shouldSignal = sustained && cooled;
	}
	if (row) {
		await db
			.update(machinePressureState)
			.set({
				lastSignalAt: shouldSignal ? new Date(nowMs) : row.lastSignalAt,
				samples,
			})
			.where(
				and(
					eq(machinePressureState.machineId, h.machineId),
					eq(machinePressureState.scopeKey, scopeKey),
				),
			);
	} else {
		await db.insert(machinePressureState).values({
			lastSignalAt: shouldSignal ? new Date(nowMs) : null,
			machineId: h.machineId,
			samples,
			scopeKey,
		});
	}
	if (!shouldSignal) return;
	// scopeHint is a projectId only when the user owns that project.
	let projectId: string | null = null;
	if (h.scopeHint) {
		const [p] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(eq(projects.id, h.scopeHint), eq(projects.createdBy, h.userId)),
			)
			.limit(1);
		if (p) projectId = p.id;
	}
	await db.insert(signals).values({
		body: `machine pressure cpu=${h.cpu.toFixed(1)} disk=${h.disk.toFixed(1)}`,
		id: crypto.randomUUID(),
		projectId,
		severity: h.disk > threshold ? "critical" : "warning",
		source: "alert",
		status: "new",
		title: `Machine pressure on ${h.machineId.slice(0, 8)}`,
		userId: h.userId,
	});
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

// --- Tasks: claim / logs / done --------------------------------------------

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/**
 * Atomic claim: `queued → running` guarded by `WHERE status='queued'`.
 * Returns true on claim, false on conflict (authoritative 409 upstream).
 * On success also opens a `task_runs` row so every execution attempt is
 * tracked (browser reads via `runs.*`; see `finishTask` for terminal sync).
 */
export async function claimTask(
	taskId: string,
	machineId: string,
	userId: string,
	sandboxId: string,
): Promise<boolean> {
	const now = new Date();
	const updated = await db
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
	await db
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
	await db.insert(taskRuns).values({
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
	if (!TERMINAL_STATUSES.has(status)) return false;
	const now = new Date();
	const updated = await db
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
	// Close the open run (there is at most one: claims require `queued`).
	await db
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
}

// --- Server → machine fan-out -------------------------------------------------

export interface ResetStateInput {
	keys?: string[] | "*";
	payload?: Record<string, unknown>;
}

export async function resetState(
	machineId: string,
	input: ResetStateInput,
	version = "v1",
): Promise<{ jobId: string; keys: string[] | "*"; sent: boolean }> {
	const jobId = `job_${Date.now()}`;
	const keys = input.keys ?? "*";
	const frame = {
		jobId,
		keys,
		payload: input.payload ?? {},
		t: "reset-config",
		version,
	};
	const sent = sendToMachine(machineId, frame);
	return { jobId, keys, sent };
}

export function machineConnected(machineId: string): boolean {
	return isMachineConnected(machineId);
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

/** Latest-version gate for the daemon upgrade check. */
export function latestVersion(): { latest: string; min: string } {
	return { latest: MIN_CLI_VERSION, min: MIN_CLI_VERSION };
}

/** Total row counts for `/health` without leaking contents. */
export async function healthCounts(): Promise<{
	machines: number;
	tasks: number;
}> {
	const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(machines);
	const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(tasks);
	return { machines: m?.n ?? 0, tasks: t?.n ?? 0 };
}
