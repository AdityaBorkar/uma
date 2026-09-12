import {
	type AssignFrame,
	type Limits,
	LOG_FRAME_CAP_BYTES,
	type MachineFrame,
	type QuotaUsage,
} from "@uma/orpc-contract";
import { customAlphabet } from "nanoid";
import pRetry, { AbortError } from "p-retry";

import { buildSecretSpecs, exportProviderEnv } from "../config/providers.ts";
import { loadIdentity } from "../enrollment/enroll.ts";
import { resolveLimits } from "../enrollment/limits.ts";
import {
	QuotaExceededError,
	quotaPreCheck,
	Sandbox,
	snapshotQuota,
} from "../sandboxes/sandbox.ts";
import {
	bufferLog,
	deleteLogBufferThrough,
	peekLogBuffer,
	readProviderKeys,
	recordSandboxEventBestEffort,
	withDb,
} from "../utils/db.ts";
import { stateDbPath } from "../utils/env.ts";
import { RepoBinding } from "./git-binding.ts";
import { assertMachineFrame, quotaRefusalFrames } from "./protocol.ts";
import { Redactor, splitChunks } from "./redact.ts";

/** Terminal state of one Sandbox Execution (CONTEXT.md: Execution Outcome). */
export type ExecutionOutcome =
	| { sandboxId: string; status: "completed" | "failed" | "cancelled" }
	| { reason: "server" | "unreachable"; sandboxId: string; status: "rejected" }
	| { limits: Limits; status: "refused"; usage: QuotaUsage };

/** Every outbound v1 frame for one execution crosses this seam. */
export type Emit = (frame: MachineFrame) => void;

export interface ClaimRequest {
	machineId: string;
	sandboxId: string;
	serverUrl: string;
	taskId: string;
	token: string;
}

/** Server answer to a claim: ok, authoritative refusal, or unreachable. */
export type ClaimResult = "ok" | "rejected" | "unreachable";
export type Claim = (req: ClaimRequest) => Promise<ClaimResult>;

/** Stable engine configuration (emit is per-connection and passed to executeTask). */
export interface ExecutionEngineOptions {
	/** Agent binary override (CLI --agent); falls back to UMA_AGENT_BIN. */
	agentBin?: string | undefined;
	claim?: Claim | undefined;
}

interface InFlightExecution {
	cancelled: boolean;
	sandboxId: string;
}

// Collision-resistant 6-char suffix: lowercase no-lookalikes (no 0/1/l/o),
// URL-safe, deterministic length (Math.random().toString(36) varied in length).
const sandboxRand = customAlphabet("23456789abcdefghijkmnopqrstuvwxyz", 6);

export function sandboxNameFor(taskId: string): string {
	const short = taskId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "task";
	const rand = sandboxRand();
	return `task-${short}-${rand}`;
}

/**
 * One Sandbox Execution lifecycle: admission -> create -> claim -> start ->
 * Worktree Binding -> exec-stream -> terminal -> stop, with failure cleanup
 * wrapping create and cancellation routed through in-flight state.
 *
 * In-flight executions and the admission lock are instance state, so each
 * engine is an isolated unit (the daemon owns one; tests construct their own).
 * Every outbound frame crosses the `emit` passed to `executeTask`; the
 * returned Execution Outcome is for callers' logs and exit codes only.
 */
export class ExecutionEngine {
	private readonly inFlight = new Map<string, InFlightExecution>();
	// Admission lock: concurrent assigns must not both pass the same quota
	// snapshot. Only snapshot + create are serialized, not whole executions.
	private admissionChain: Promise<unknown> = Promise.resolve();

	constructor(private readonly opts: ExecutionEngineOptions = {}) {}

	async executeTask(
		assign: AssignFrame,
		emit: Emit,
	): Promise<ExecutionOutcome> {
		const identity = loadIdentity();
		if (!identity) throw new Error("not enrolled");

		const storedKeys = this.loadStoredKeys();
		const secretSpecs = buildSecretSpecs(storedKeys);
		const redactor = this.buildRedactor(
			identity.sessionToken,
			storedKeys.map((k) => k.secret),
			assign.prompt,
		);
		// Server limits live on the assign frame; resolveLimits keeps file/default precedence.
		const limits = resolveLimits(assign.limits ?? null);

		let created: Sandbox;
		try {
			created = await this.withAdmission(async () => {
				const { running, total } = await snapshotQuota();
				quotaPreCheck(running, total, limits);
				exportProviderEnv(storedKeys);
				const sb = await Sandbox.create({
					name: sandboxNameFor(assign.taskId),
					projectId: assign.projectId,
					secrets: secretSpecs,
					taskId: assign.taskId,
				});
				this.inFlight.set(assign.taskId, {
					cancelled: false,
					sandboxId: sb.name,
				});
				return sb;
			});
		} catch (e) {
			if (e instanceof QuotaExceededError) {
				const usage = e.usage;
				for (const frame of quotaRefusalFrames({
					limits,
					machineId: identity.machineId,
					sandboxId: sandboxNameFor(assign.taskId),
					taskId: assign.taskId,
					usage,
				})) {
					this.emitBestEffort(emit, frame, frame.t);
				}
				return { limits, status: "refused", usage };
			}
			throw e;
		}

		const sandboxId = created.name;
		let terminal = false;
		try {
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "created",
				sandboxId,
				taskId: assign.taskId,
			});

			if (this.isCancelled(assign.taskId)) {
				terminal = true;
				return { sandboxId, status: "cancelled" };
			}

			const claim = this.opts.claim ?? ((req) => this.claimTask(req));
			const claimResult = await claim({
				machineId: identity.machineId,
				sandboxId,
				serverUrl: identity.serverUrl,
				taskId: assign.taskId,
				token: identity.sessionToken,
			});
			this.emitBestEffort(
				emit,
				{
					machineId: identity.machineId,
					ok: claimResult === "ok",
					protocol: "v1",
					sandboxId,
					t: "claim-ack",
					taskId: assign.taskId,
					...(claimResult === "ok"
						? {}
						: {
								error:
									claimResult === "rejected"
										? "CLAIM_REJECTED"
										: "CLAIM_UNREACHABLE",
							}),
				},
				"claim-ack",
			);
			if (claimResult !== "ok")
				return {
					reason: claimResult === "rejected" ? "server" : claimResult,
					sandboxId,
					status: "rejected",
				};
			if (this.isCancelled(assign.taskId)) {
				terminal = true;
				return { sandboxId, status: "cancelled" };
			}

			// Replay any SQLite-buffered logs for this task before live streaming.
			this.resendBufferedLogs(
				assign.taskId,
				identity.machineId,
				redactor,
				emit,
			);

			await created.start();
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "running",
				sandboxId,
				taskId: assign.taskId,
			});

			// Start then bind: binding is verified before exec
			// (start -> ensureBinding -> exec).
			const repo = new RepoBinding(sandboxId);
			const binding = {
				branch: assign.branch,
				commit: assign.commit,
				repoUrl: assign.repoUrl ?? "",
				taskId: assign.taskId,
			};
			await repo.ensure(binding);
			if (assign.freshStart) await repo.freshStart(binding);

			const flush = this.makeFlush(
				assign.taskId,
				identity.machineId,
				redactor,
				emit,
			);

			// Fail closed: never let a placeholder report a completed task.
			const agentBin = this.opts.agentBin ?? process.env.UMA_AGENT_BIN;
			if (!agentBin) {
				flush(
					"system",
					"no agent configured: set UMA_AGENT_BIN or pass --agent; task not executed",
				);
				this.emitBestEffort(
					emit,
					{
						machineId: identity.machineId,
						projectId: assign.projectId,
						protocol: "v1",
						status: "failed",
						t: "task-done",
						taskId: assign.taskId,
					},
					"task-done",
				);
				recordSandboxEventBestEffort(stateDbPath(), {
					event: "failed",
					sandboxId,
					taskId: assign.taskId,
				});
				await this.stopAfterTask(created, sandboxId, assign.taskId);
				terminal = true;
				return { sandboxId, status: "failed" };
			}

			const { bin, args } = this.buildAgentCommand(
				agentBin,
				assign.taskId,
				assign.prompt,
			);

			let code = 1;
			try {
				code = await created.execStream(bin, args, flush);
			} catch (e) {
				if (this.isCancelled(assign.taskId)) {
					terminal = true;
					return { sandboxId, status: "cancelled" };
				}
				flush(
					"system",
					`exec failed: ${e instanceof Error ? redactor.redact(e.message) : "unknown"}`,
				);
				code = 1;
			}
			// Cancel may have stopped the sandbox mid-exec: server owns the cancel,
			// so do not emit task-done against it. Idle stopped for TTL reap.
			if (this.isCancelled(assign.taskId)) {
				terminal = true;
				return { sandboxId, status: "cancelled" };
			}

			const status = code === 0 ? "completed" : "failed";
			this.emitBestEffort(
				emit,
				{
					machineId: identity.machineId,
					projectId: assign.projectId,
					protocol: "v1",
					status,
					t: "task-done",
					taskId: assign.taskId,
				},
				"task-done",
			);
			recordSandboxEventBestEffort(stateDbPath(), {
				event: status,
				sandboxId,
				taskId: assign.taskId,
			});

			// Idle stopped for TTL reap (reap owns removal; never remove here).
			await this.stopAfterTask(created, sandboxId, assign.taskId);
			terminal = true;
			return { sandboxId, status };
		} catch (e) {
			if (this.isCancelled(assign.taskId)) {
				terminal = true;
				return { sandboxId, status: "cancelled" };
			}
			throw e;
		} finally {
			this.inFlight.delete(assign.taskId);
			// Failure cleanup: an unclaimed/unstarted sandbox must not eat quota.
			if (!terminal) {
				await created.stop(true).catch(() => {});
				await created.remove().catch(() => {});
				recordSandboxEventBestEffort(stateDbPath(), {
					event: "destroyed",
					sandboxId,
					taskId: assign.taskId,
				});
			}
		}
	}

	/** Cancel one Sandbox Execution: stop --force and mark it cancelled. */
	async cancelTask(taskId: string): Promise<boolean> {
		const flight = this.inFlight.get(taskId);
		let sandboxId = flight?.sandboxId;
		if (!sandboxId) {
			// Fallback: resolve via sandbox labels (task.id) so cancels work even if
			// the daemon restarted and lost its in-flight state.
			try {
				const all = await Sandbox.list();
				sandboxId = all.find((s) => s.taskId === taskId)?.id;
			} catch {
				// ignore
			}
		}
		if (!sandboxId) return false;
		if (flight) flight.cancelled = true;
		await new Sandbox(sandboxId).stop(true);
		recordSandboxEventBestEffort(stateDbPath(), {
			event: "stopped",
			sandboxId,
			taskId,
		});
		return true;
	}

	/** Default claim: HTTPS with p-retry; 409/4xx authoritative, other failures unreachable. */
	async claimTask(req: ClaimRequest): Promise<ClaimResult> {
		try {
			const res = await pRetry(
				async () => {
					const r = await fetch(`${req.serverUrl}/api/machines/claim`, {
						body: JSON.stringify({
							machineId: req.machineId,
							sandboxId: req.sandboxId,
							taskId: req.taskId,
						}),
						headers: {
							authorization: `Bearer ${req.token}`,
							"content-type": "application/json",
						},
						method: "POST",
						signal: AbortSignal.timeout(8000),
					});
					// 409 authoritative claim rejection + other 4xx are final —
					// AbortError stops p-retry without consuming retries.
					if (r.status === 409)
						throw new AbortError("claim rejected (409 authoritative)");
					if (r.status >= 400 && r.status < 500)
						throw new AbortError(`claim rejected: HTTP ${r.status}`);
					if (!r.ok) throw new Error(`claim failed: HTTP ${r.status}`);
					return r;
				},
				{
					factor: 2,
					maxTimeout: 4000,
					minTimeout: 500,
					randomize: true,
					retries: 3,
				},
			);
			return res.ok ? "ok" : "unreachable";
		} catch (e) {
			return e instanceof AbortError ? "rejected" : "unreachable";
		}
	}

	private isCancelled(taskId: string): boolean {
		return this.inFlight.get(taskId)?.cancelled === true;
	}

	private withAdmission<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.admissionChain.then(fn, fn);
		this.admissionChain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private buildRedactor(
		sessionToken: string,
		secrets: string[],
		prompt?: string,
	): Redactor {
		const r = new Redactor();
		r.addSecret(sessionToken);
		r.addMany(secrets);
		// Seed the task prompt: echoed prompts may carry user secrets, and the
		// verbatim layer only matches exact registered strings.
		if (prompt) r.addSecret(prompt);
		const gh = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
		if (gh) r.addSecret(gh);
		return r;
	}

	private loadStoredKeys(): { provider: string; secret: string }[] {
		return readProviderKeys(stateDbPath()).map((k) => ({
			provider: k.provider,
			secret: k.secret,
		}));
	}

	/** Validate + emit one frame; throws on invalid shape or transport failure. */
	private emitChecked(emit: Emit, frame: Record<string, unknown>): void {
		assertMachineFrame(frame);
		emit(frame as MachineFrame);
	}

	/** Validated emit where transport failure is a warn, not execution failure. */
	private emitBestEffort(
		emit: Emit,
		frame: Record<string, unknown>,
		what: string,
	): void {
		try {
			this.emitChecked(emit, frame);
		} catch (e) {
			console.error(
				`warn: ${what} frame not sent: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}

	/** Buffer one log chunk to SQLite; drops on DB pressure rather than failing the task. */
	private bufferChunkBestEffort(taskId: string, chunk: string): void {
		try {
			withDb(stateDbPath(), false, (db) => {
				bufferLog(db, taskId, chunk);
			});
		} catch {
			// drop chunk rather than fail the task on DB pressure
		}
	}

	private buildAgentCommand(
		agentBin: string,
		taskId: string,
		prompt: string,
	): { bin: string; args: string[] } {
		if (agentBin !== "sh") return { args: [prompt], bin: agentBin };
		// Positional args: the prompt is untrusted and must never be interpolated
		// into the shell program text. Explicit `sh` only; never a default.
		return {
			args: [
				"-c",
				'echo "task $1: $2" && echo done',
				"sh",
				taskId,
				prompt.slice(0, 200),
			],
			bin: "sh",
		};
	}

	/** Redact + split + emit-or-buffer log data as 256KB frames. */
	private makeFlush(
		taskId: string,
		machineId: string,
		redactor: Redactor,
		emit: Emit,
	): (stream: "stdout" | "stderr" | "system", data: string) => void {
		return (stream, data) => {
			for (const chunk of splitChunks(
				redactor.redact(data),
				LOG_FRAME_CAP_BYTES,
			)) {
				let frame: Record<string, unknown>;
				try {
					frame = redactor.redactObject({
						chunk,
						machineId,
						protocol: "v1",
						stream,
						t: "log",
						taskId,
					});
				} catch {
					// fail closed: buffer the chunk rather than send it unredacted
					this.bufferChunkBestEffort(taskId, chunk);
					continue;
				}
				try {
					this.emitChecked(emit, frame);
				} catch {
					this.bufferChunkBestEffort(taskId, chunk);
				}
			}
		};
	}

	/** Resend SQLite-buffered logs: send first, delete after (at-least-once). */
	private resendBufferedLogs(
		taskId: string,
		machineId: string,
		redactor: Redactor,
		emit: Emit,
	): number {
		let rows: { rowid: number; ts: number; chunk: string }[] = [];
		try {
			withDb(stateDbPath(), false, (db) => {
				rows = peekLogBuffer(db, taskId);
			});
		} catch {
			return 0;
		}
		let sent = 0;
		let lastSentRowid: number | null = null;
		for (const { rowid, chunk } of rows) {
			// Re-redact on resend: chunks buffered before a secret was registered
			// (prompt seeding, late provider keys) must not leak raw.
			const safe = redactor.redact(chunk);
			try {
				const base = {
					chunk: safe,
					machineId,
					protocol: "v1",
					t: "log",
					taskId,
				};
				this.emitChecked(emit, redactor.redactObject(base));
				sent++;
				lastSentRowid = rowid;
			} catch {
				// Stop at the first failure: this row and the rest stay buffered.
				break;
			}
		}
		if (lastSentRowid !== null) {
			const through = lastSentRowid;
			try {
				withDb(stateDbPath(), false, (db) => {
					deleteLogBufferThrough(db, taskId, through);
				});
			} catch {
				// delete failure only means a duplicate replay later, never loss
			}
		}
		return sent;
	}

	/** Idle stop after a terminal outcome (TTL reap owns removal; never remove here). */
	private async stopAfterTask(
		sandbox: Sandbox,
		sandboxId: string,
		taskId: string,
	): Promise<void> {
		try {
			await sandbox.stop(true);
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "stopped",
				sandboxId,
				taskId,
			});
		} catch (e) {
			console.error(
				`warn: post-task stop failed for ${sandboxId}: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
	}
}
