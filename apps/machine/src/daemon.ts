import type { ServerFrame } from "@uma/orpc-contract";
import { needsUpgrade } from "@uma/orpc-contract";
import ms from "ms";

import { loadDesired, saveDesired } from "./config/desired.ts";
import { resetAll } from "./config/mod.ts";
import {
	lastSandboxEventTsBatch,
	persistReceiptsBestEffort,
	recordSandboxEventBestEffort,
	withDb,
} from "./db.ts";
import { loadIdentity } from "./enroll.ts";
import { daemonIntervalS, sandboxTtlMs, stateDbPath } from "./env.ts";
import { cancelTask, executeTask } from "./execution.ts";
import { buildHeartbeat, persistHeartbeat } from "./heartbeat.ts";
import { Redactor } from "./redact.ts";
import { listSandboxes, removeSandbox, snapshotQuota } from "./sandbox.ts";
import { CLI_VERSION } from "./version.ts";
import { connectWithBackoff } from "./ws-client.ts";

export interface DaemonOptions {
	intervalS?: number;
	once?: boolean;
}

type Send = (f: Record<string, unknown>) => void;

async function sendHeartbeat(send?: Send) {
	const { running, total } = await snapshotQuota();
	const frame = await buildHeartbeat({ running, total });
	persistHeartbeat(frame);
	if (send) {
		try {
			send(frame);
		} catch {
			// send failure != loss (SQLite persisted; history queryable)
		}
	}
	return frame;
}

function handleUpgrade(
	frame: Extract<ServerFrame, { t: "UPGRADE_REQUIRED" }>,
): void {
	// Server asks for the minimum; only a real version shortfall is fatal.
	if (!needsUpgrade(CLI_VERSION, frame.minVersion)) {
		console.warn(
			`UPGRADE_REQUIRED ignored: cli ${CLI_VERSION} >= min ${frame.minVersion}`,
		);
		return;
	}
	console.error(
		`UPGRADE_REQUIRED: daemon ${CLI_VERSION} < min ${frame.minVersion} (${frame.reason ?? "major mismatch"}). Re-run install.sh.`,
	);
	process.exit(3);
}

async function handleAssign(
	frame: Extract<ServerFrame, { t: "assign" }>,
	send: Send,
	redactor: Redactor,
): Promise<void> {
	try {
		const res = await executeTask(frame, { emit: send });
		if (res.status === "refused")
			console.warn(`task ${frame.taskId}: refused (quota exceeded)`);
		else if (res.status === "rejected")
			console.error(
				`task ${frame.taskId}: claim ${res.reason}; unclaimed sandbox freed`,
			);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(
			`task ${frame.taskId} failed: ${redactor.redact(msg).slice(0, 300)}`,
		);
	}
}

async function handleResetConfig(
	frame: Extract<ServerFrame, { t: "reset-config" }>,
	send: Send,
	machineId: string,
): Promise<void> {
	const keys = frame.keys === "*" ? undefined : frame.keys;
	const receipts = await resetAll({ only: keys, payload: frame.payload });
	// Cache desired-state before acks: a crash after acking must not leave the
	// server-converged config un-cached locally.
	if (frame.payload?.templates || frame.payload?.limits) {
		try {
			const d = loadDesired();
			if (frame.payload.templates) d.templates = frame.payload.templates;
			if (frame.payload.limits) d.limits = frame.payload.limits;
			d.version = frame.version;
			saveDesired(d);
		} catch (e) {
			console.error(
				`warn: desired state not cached: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}
	// Phase 1: persist all receipts first (a send failure must not skip rows).
	// Best-effort so a DB hiccup never masks converge results; acks still send.
	persistReceiptsBestEffort(stateDbPath(), frame.jobId, receipts);
	// Phase 2: ack each key; one dropped ack must not abort the rest.
	for (const r of receipts) {
		try {
			send({
				jobId: frame.jobId,
				key: r.key,
				machineId,
				ok: r.ok,
				protocol: "v1",
				t: "reset-ack",
				...(r.error ? { error: r.error } : {}),
			});
		} catch {
			// persisted above; history queryable
		}
	}
	if (frame.keys === "*") {
		try {
			send({
				jobId: frame.jobId,
				machineId,
				protocol: "v1",
				receipts: receipts.map((r) => ({
					key: r.key,
					ok: r.ok,
					...(r.error ? { error: r.error } : {}),
				})),
				t: "sync-ack",
			});
		} catch {
			// persisted above
		}
	}
}

/**
 * Main loop tying ws-client + heartbeat + execution + quota enforcement
 * (effective = server override ?? limits.json).
 */
export async function runDaemon(opts?: DaemonOptions): Promise<() => void> {
	const identity = loadIdentity();
	if (!identity)
		throw new Error("not enrolled — run `uma-machine enroll` first");
	const intervalS = daemonIntervalS(opts?.intervalS);
	const redactor = new Redactor();
	redactor.addSecret(identity.sessionToken);
	const gh = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
	if (gh) redactor.addSecret(gh);
	let stopped = false;

	const handleFrame = async (frame: ServerFrame, send: Send) => {
		if (frame.t === "UPGRADE_REQUIRED") handleUpgrade(frame);
		else if (frame.t === "assign") await handleAssign(frame, send, redactor);
		else if (frame.t === "cancel") await cancelTask(frame.taskId);
		else if (frame.t === "reset-config")
			await handleResetConfig(frame, send, identity.machineId);
	};

	// Heartbeat tick loop (persists even when ws is down).
	let lastSend: Send | undefined;
	const tick = setInterval(() => {
		void sendHeartbeat(lastSend).catch((e) =>
			console.error(
				`heartbeat failed: ${e instanceof Error ? e.message : String(e)}`,
			),
		);
		// TTL reap is server-driven in v1; here we opportunistically reap
		// long-stopped sandboxes older than 1h (best-effort, never running).
		void reapStopped().catch(() => {});
	}, intervalS * ms("1s"));

	const stopWs = await connectWithBackoff(
		{
			onClose: (code, reason) => {
				lastSend = undefined;
				console.log(`ws closed ${code} ${reason}; reconnecting with backoff`);
			},
			onError: (e) => console.error(`ws error: ${String(e).slice(0, 200)}`),
			onFrame: handleFrame,
			onOpen: (send) => {
				lastSend = send;
				console.log("connected to server ws");
				void sendHeartbeat(send).catch(() => {});
			},
		},
		{ shouldStop: () => stopped },
	);

	if (opts?.once) {
		await sendHeartbeat(undefined);
		clearInterval(tick);
		stopWs();
		return () => {};
	}

	// Initial heartbeat immediately.
	await sendHeartbeat(undefined);

	const stop = () => {
		stopped = true;
		clearInterval(tick);
		stopWs();
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	return stop;
}

async function reapStopped(): Promise<void> {
	// Server TTL governs; locally reap stopped sandboxes idle longer than
	// UMA_SANDBOX_TTL_S (default 1h). Age comes from sandbox_events (written on
	// create/stop/done); sandboxes with no event row are never reaped here.
	// Running sandboxes are never touched.
	const ttlMs = sandboxTtlMs();
	const now = Date.now();
	const sandboxes = await listSandboxes();
	const stoppedIds = sandboxes
		.filter((s) => s.status === "stopped")
		.map((s) => s.id);
	if (stoppedIds.length === 0) return;
	let reapable: string[] = [];
	try {
		reapable = withDb(stateDbPath(), true, (db) => {
			const lastById = lastSandboxEventTsBatch(db, stoppedIds);
			return stoppedIds.filter((id) => {
				const last = lastById.get(id);
				return last !== undefined && now - last > ttlMs;
			});
		});
	} catch {
		return; // no readable DB yet; reap later
	}
	for (const id of reapable) {
		try {
			await removeSandbox(id);
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "destroyed",
				sandboxId: id,
			});
		} catch {
			// best-effort reap; retry next tick
		}
	}
}
