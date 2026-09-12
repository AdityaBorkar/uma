import type { ServerFrame } from "@uma/orpc-contract";
import { needsUpgrade } from "@uma/orpc-contract";
import ms from "ms";

import { loadDesired, saveDesired } from "./config/desired.ts";
import { resetAll } from "./config/mod.ts";
import { loadIdentity } from "./enroll.ts";
import { daemonIntervalS, sandboxTtlMs, stateDbPath } from "./env.ts";
import { cancelTask, executeTask } from "./execution.ts";
import { Heartbeat } from "./heartbeat.ts";
import { Redactor } from "./redact.ts";
import { Sandbox, snapshotQuota } from "./sandbox.ts";
import {
	lastSandboxEventTsBatch,
	persistReceiptsBestEffort,
	recordSandboxEventBestEffort,
	withDb,
} from "./utils/db.ts";
import { CLI_VERSION } from "./version.ts";
import { connectWithBackoff } from "./ws-client.ts";

export interface DaemonOptions {
	intervalS?: number;
	once?: boolean;
}

type Send = (f: Record<string, unknown>) => void;

type AssignFrameOf = Extract<ServerFrame, { t: "assign" }>;
type ResetConfigFrame = Extract<ServerFrame, { t: "reset-config" }>;
type UpgradeFrame = Extract<ServerFrame, { t: "UPGRADE_REQUIRED" }>;

/**
 * Long-running daemon loop: ws frames in, heartbeats + task executions out.
 * State lives on the instance (stop flag, last sender, redactor) instead of
 * closure locals.
 */
export class Daemon {
	private readonly intervalS: number;
	private readonly once: boolean;
	private readonly redactor = new Redactor();
	private readonly heartbeat = new Heartbeat();
	private machineId = "";
	private stopped = false;
	private lastSend: Send | undefined;

	constructor(opts: DaemonOptions = {}) {
		this.intervalS = daemonIntervalS(opts.intervalS);
		this.once = opts.once ?? false;
	}

	/**
	 * Main loop tying ws-client + heartbeat + execution + quota enforcement
	 * (effective = server override ?? limits.json). Returns a stop function.
	 */
	async run(): Promise<() => void> {
		const identity = loadIdentity();
		if (!identity)
			throw new Error("not enrolled — run `uma-machine enroll` first");
		this.machineId = identity.machineId;
		this.redactor.addSecret(identity.sessionToken);
		const gh = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
		if (gh) this.redactor.addSecret(gh);

		// Heartbeat tick loop (persists even when ws is down).
		const tick = setInterval(() => {
			void this.sendHeartbeat(this.lastSend).catch((e) =>
				console.error(
					`heartbeat failed: ${e instanceof Error ? e.message : String(e)}`,
				),
			);
			// TTL reap is server-driven in v1; here we opportunistically reap
			// long-stopped sandboxes older than 1h (best-effort, never running).
			void this.reapStopped().catch(() => {});
		}, this.intervalS * ms("1s"));

		const stopWs = await connectWithBackoff(
			{
				onClose: (code, reason) => {
					this.lastSend = undefined;
					console.log(`ws closed ${code} ${reason}; reconnecting with backoff`);
				},
				onError: (e) => console.error(`ws error: ${String(e).slice(0, 200)}`),
				onFrame: (frame, send) => this.handleFrame(frame, send),
				onOpen: (send) => {
					this.lastSend = send;
					console.log("connected to server ws");
					void this.sendHeartbeat(send).catch(() => {});
				},
			},
			{ shouldStop: () => this.stopped },
		);

		if (this.once) {
			await this.sendHeartbeat(undefined);
			clearInterval(tick);
			stopWs();
			return () => {};
		}

		// Initial heartbeat immediately.
		await this.sendHeartbeat(undefined);

		const stop = () => {
			this.stopped = true;
			clearInterval(tick);
			stopWs();
		};
		process.on("SIGINT", stop);
		process.on("SIGTERM", stop);
		return stop;
	}

	private async sendHeartbeat(send?: Send) {
		const { running, total } = await snapshotQuota();
		const frame = await this.heartbeat.build({ running, total });
		this.heartbeat.persist(frame);
		if (send) {
			try {
				send(frame);
			} catch {
				// send failure != loss (SQLite persisted; history queryable)
			}
		}
		return frame;
	}

	private async handleFrame(frame: ServerFrame, send: Send): Promise<void> {
		if (frame.t === "UPGRADE_REQUIRED") this.handleUpgrade(frame);
		else if (frame.t === "assign") await this.handleAssign(frame, send);
		else if (frame.t === "cancel") await cancelTask(frame.taskId);
		else if (frame.t === "reset-config")
			await this.handleResetConfig(frame, send);
	}

	private handleUpgrade(frame: UpgradeFrame): void {
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

	private async handleAssign(frame: AssignFrameOf, send: Send): Promise<void> {
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
				`task ${frame.taskId} failed: ${this.redactor.redact(msg).slice(0, 300)}`,
			);
		}
	}

	private async handleResetConfig(
		frame: ResetConfigFrame,
		send: Send,
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
					machineId: this.machineId,
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
					machineId: this.machineId,
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

	private async reapStopped(): Promise<void> {
		// Server TTL governs; locally reap stopped sandboxes idle longer than
		// UMA_SANDBOX_TTL_S (default 1h). Age comes from sandbox_events (written on
		// create/stop/done); sandboxes with no event row are never reaped here.
		// Running sandboxes are never touched.
		const ttlMs = sandboxTtlMs();
		const now = Date.now();
		const sandboxes = await Sandbox.list();
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
				await new Sandbox(id).remove();
				recordSandboxEventBestEffort(stateDbPath(), {
					event: "destroyed",
					sandboxId: id,
				});
			} catch {
				// best-effort reap; retry next tick
			}
		}
	}
}

// Legacy entry kept for existing callers: run a Daemon to completion.
export async function runDaemon(opts?: DaemonOptions): Promise<() => void> {
	return new Daemon(opts).run();
}
