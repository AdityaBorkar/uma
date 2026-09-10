import {
	type AssignFrame,
	type Limits,
	LOG_FRAME_CAP_BYTES,
	type MachineFrame,
	type QuotaUsage,
} from "@uma/orpc-contract";
import { customAlphabet } from "nanoid";
import pRetry, { AbortError } from "p-retry";

import { buildSecretSpecs, exportProviderEnv } from "./config/providers.ts";
import {
	bufferLog,
	deleteLogBufferThrough,
	peekLogBuffer,
	readProviderKeys,
	recordSandboxEventBestEffort,
	withDb,
} from "./db.ts";
import { loadIdentity } from "./enroll.ts";
import { stateDbPath } from "./env.ts";
import { ensureBinding, freshStart } from "./git-binding.ts";
import { resolveLimits } from "./limits.ts";
import { assertMachineFrame, quotaRefusalFrames } from "./protocol.ts";
import { Redactor, splitChunks } from "./redact.ts";
import {
	createSandbox,
	execStreamInSandbox,
	listSandboxes,
	QuotaExceededError,
	quotaPreCheck,
	removeSandbox,
	snapshotQuota,
	startSandbox,
	stopSandbox,
} from "./sandbox.ts";

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

export interface ExecutionDeps {
	/** Agent binary override (CLI --agent); falls back to UMA_AGENT_BIN. */
	agentBin?: string;
	claim?: Claim;
	emit: Emit;
}

// Collision-resistant 6-char suffix: lowercase no-lookalikes (no 0/1/l/o),
// URL-safe, deterministic length (Math.random().toString(36) varied in length).
const sandboxRand = customAlphabet("23456789abcdefghijkmnopqrstuvwxyz", 6);

export function sandboxNameFor(taskId: string): string {
	const short = taskId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "task";
	const rand = sandboxRand();
	return `task-${short}-${rand}`;
}

interface InFlightExecution {
	cancelled: boolean;
	sandboxId: string;
}

const inFlight = new Map<string, InFlightExecution>();

function isCancelled(taskId: string): boolean {
	return inFlight.get(taskId)?.cancelled === true;
}

// Admission lock: concurrent assigns must not both pass the same quota
// snapshot. Only snapshot + create are serialized, not whole executions.
let admissionChain: Promise<unknown> = Promise.resolve();

function withAdmission<T>(fn: () => Promise<T>): Promise<T> {
	const run = admissionChain.then(fn, fn);
	admissionChain = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

function buildRedactor(
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

function loadStoredKeys(): { provider: string; secret: string }[] {
	return readProviderKeys(stateDbPath()).map((k) => ({
		provider: k.provider,
		secret: k.secret,
	}));
}

/** Validate + emit one frame; throws on invalid shape or transport failure. */
function emitChecked(emit: Emit, frame: Record<string, unknown>): void {
	assertMachineFrame(frame);
	emit(frame as MachineFrame);
}

/** Validated emit where transport failure is a warn, not execution failure. */
function emitBestEffort(
	emit: Emit,
	frame: Record<string, unknown>,
	what: string,
): void {
	try {
		emitChecked(emit, frame);
	} catch (e) {
		console.error(
			`warn: ${what} frame not sent: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

/** Buffer one log chunk to SQLite; drops on DB pressure rather than failing the task. */
function bufferChunkBestEffort(taskId: string, chunk: string): void {
	try {
		withDb(stateDbPath(), false, (db) => {
			bufferLog(db, taskId, chunk);
		});
	} catch {
		// drop chunk rather than fail the task on DB pressure
	}
}

function buildAgentCommand(
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
function makeFlush(
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
				bufferChunkBestEffort(taskId, chunk);
				continue;
			}
			try {
				emitChecked(emit, frame);
			} catch {
				bufferChunkBestEffort(taskId, chunk);
			}
		}
	};
}

/** Resend SQLite-buffered logs: send first, delete after (at-least-once). */
function resendBufferedLogs(
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
			emitChecked(emit, redactor.redactObject(base));
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

/** Default claim: HTTPS with p-retry; 409/4xx authoritative, other failures unreachable. */
export async function claimTask(req: ClaimRequest): Promise<ClaimResult> {
	try {
		const res = await pRetry(
			async () => {
				const r = await fetch(`${req.serverUrl}/rpc/tasks.claim`, {
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

/**
 * One Sandbox Execution: admission -> create -> claim -> start -> Worktree
 * Binding -> exec-stream -> terminal -> stop, with failure cleanup wrapping
 * create and cancellation routed through in-flight state. Every outbound frame
 * crosses `deps.emit`; the returned Execution Outcome is for callers' logs and
 * exit codes only.
 */
export async function executeTask(
	assign: AssignFrame,
	deps: ExecutionDeps,
): Promise<ExecutionOutcome> {
	const identity = loadIdentity();
	if (!identity) throw new Error("not enrolled");

	const storedKeys = loadStoredKeys();
	const secretSpecs = buildSecretSpecs(storedKeys);
	const redactor = buildRedactor(
		identity.sessionToken,
		storedKeys.map((k) => k.secret),
		assign.prompt,
	);
	// Server limits live on the assign frame; resolveLimits keeps file/default precedence.
	const limits = resolveLimits(assign.limits ?? null);

	let created: { id: string; name: string };
	try {
		created = await withAdmission(async () => {
			const { running, total } = await snapshotQuota();
			quotaPreCheck(running, total, limits);
			exportProviderEnv(storedKeys);
			const sb = await createSandbox({
				name: sandboxNameFor(assign.taskId),
				projectId: assign.projectId,
				secrets: secretSpecs,
				taskId: assign.taskId,
			});
			inFlight.set(assign.taskId, { cancelled: false, sandboxId: sb.name });
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
				emitBestEffort(deps.emit, frame, frame.t);
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

		if (isCancelled(assign.taskId)) {
			terminal = true;
			return { sandboxId, status: "cancelled" };
		}

		const claim = deps.claim ?? claimTask;
		const claimResult = await claim({
			machineId: identity.machineId,
			sandboxId,
			serverUrl: identity.serverUrl,
			taskId: assign.taskId,
			token: identity.sessionToken,
		});
		emitBestEffort(
			deps.emit,
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
		if (isCancelled(assign.taskId)) {
			terminal = true;
			return { sandboxId, status: "cancelled" };
		}

		// Replay any SQLite-buffered logs for this task before live streaming.
		resendBufferedLogs(assign.taskId, identity.machineId, redactor, deps.emit);

		await startSandbox(sandboxId);
		recordSandboxEventBestEffort(stateDbPath(), {
			event: "running",
			sandboxId,
			taskId: assign.taskId,
		});

		// Start then bind: binding is verified before exec
		// (start -> ensureBinding -> exec).
		const binding = {
			branch: assign.branch,
			commit: assign.commit,
			repoUrl: assign.repoUrl ?? "",
			sandboxName: sandboxId,
			taskId: assign.taskId,
		};
		await ensureBinding(binding);
		if (assign.freshStart) await freshStart(binding);

		const flush = makeFlush(
			assign.taskId,
			identity.machineId,
			redactor,
			deps.emit,
		);

		// Fail closed: never let a placeholder report a completed task.
		const agentBin = deps.agentBin ?? process.env.UMA_AGENT_BIN;
		if (!agentBin) {
			flush(
				"system",
				"no agent configured: set UMA_AGENT_BIN or pass --agent; task not executed",
			);
			emitBestEffort(
				deps.emit,
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
			try {
				await stopSandbox(sandboxId, true);
				recordSandboxEventBestEffort(stateDbPath(), {
					event: "stopped",
					sandboxId,
					taskId: assign.taskId,
				});
			} catch (e) {
				console.error(
					`warn: post-task stop failed for ${sandboxId}: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
			terminal = true;
			return { sandboxId, status: "failed" };
		}

		const { bin, args } = buildAgentCommand(
			agentBin,
			assign.taskId,
			assign.prompt,
		);

		let code = 1;
		try {
			code = await execStreamInSandbox(sandboxId, bin, args, flush);
		} catch (e) {
			if (isCancelled(assign.taskId)) {
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
		if (isCancelled(assign.taskId)) {
			terminal = true;
			return { sandboxId, status: "cancelled" };
		}

		const status = code === 0 ? "completed" : "failed";
		emitBestEffort(
			deps.emit,
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
		try {
			await stopSandbox(sandboxId, true);
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "stopped",
				sandboxId,
				taskId: assign.taskId,
			});
		} catch (e) {
			console.error(
				`warn: post-task stop failed for ${sandboxId}: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
		terminal = true;
		return { sandboxId, status };
	} catch (e) {
		if (isCancelled(assign.taskId)) {
			terminal = true;
			return { sandboxId, status: "cancelled" };
		}
		throw e;
	} finally {
		inFlight.delete(assign.taskId);
		// Failure cleanup: an unclaimed/unstarted sandbox must not eat quota.
		if (!terminal) {
			await stopSandbox(sandboxId, true).catch(() => {});
			await removeSandbox(sandboxId).catch(() => {});
			recordSandboxEventBestEffort(stateDbPath(), {
				event: "destroyed",
				sandboxId,
				taskId: assign.taskId,
			});
		}
	}
}

/** Cancel one Sandbox Execution: stop --force and mark it cancelled. */
export async function cancelTask(taskId: string): Promise<boolean> {
	const flight = inFlight.get(taskId);
	let sandboxId = flight?.sandboxId;
	if (!sandboxId) {
		// Fallback: resolve via sandbox labels (task.id) so cancels work even if
		// the daemon restarted and lost its in-flight state.
		try {
			const all = await listSandboxes();
			sandboxId = all.find((s) => s.taskId === taskId)?.id;
		} catch {
			// ignore
		}
	}
	if (!sandboxId) return false;
	if (flight) flight.cancelled = true;
	await stopSandbox(sandboxId, true);
	recordSandboxEventBestEffort(stateDbPath(), {
		event: "stopped",
		sandboxId,
		taskId,
	});
	return true;
}
