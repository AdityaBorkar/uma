import type { Limits, QuotaUsage, SandboxInfo } from "@uma/orpc-contract";

import { driver } from "./sandboxes/msb/driver.ts";
import type {
	CreateOpts,
	ExecResult,
	SandboxMetrics,
	SecretSpec,
	StreamName,
} from "./sandboxes/msb/types.ts";

export { driverKind } from "./sandboxes/msb/driver.ts";
export type { CreateOpts, ExecResult, SecretSpec, StreamName };

const SANDBOX_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,127}$/;

export function validateSandboxName(name: string): void {
	if (!name) throw new Error("sandbox name required");
	if (!SANDBOX_NAME_RE.test(name)) {
		throw new Error(
			"sandbox name must match [a-zA-Z0-9-] (max 128 chars, start alphanumeric)",
		);
	}
}

/** Typed quota refusal: carries the usage and limits the caller must report. */
export class QuotaExceededError extends Error {
	readonly limits: Limits;
	readonly usage: QuotaUsage;
	constructor(usage: QuotaUsage, limits: Limits) {
		super(
			`QUOTA_EXCEEDED: running=${usage.running} total=${usage.total} limits=${limits.maxRunning}/${limits.maxTotal}`,
		);
		this.name = "QuotaExceededError";
		this.limits = limits;
		this.usage = usage;
	}
}

/** Quota pre-check before create; throws QuotaExceededError when over limit. */
export function quotaPreCheck(
	running: number,
	total: number,
	limits: Limits,
): void {
	if (running + 1 > limits.maxRunning || total + 1 > limits.maxTotal) {
		throw new QuotaExceededError({ running, total }, limits);
	}
}

/** Accepts the typed error plus legacy code/message shapes. */
export function isQuotaError(e: unknown): boolean {
	return (
		e instanceof QuotaExceededError ||
		(e as { code?: string })?.code === "QUOTA_EXCEEDED" ||
		(e instanceof Error && e.message.startsWith("QUOTA_EXCEEDED"))
	);
}

// ---------------------------------------------------------------------------
// Public sandbox port (SDK → CLI → mock selection lives in sandboxes/msb/driver.ts)
// ---------------------------------------------------------------------------

export async function createSandbox(
	opts: CreateOpts,
): Promise<{ name: string; id: string }> {
	validateSandboxName(opts.name);
	return (await driver()).create(opts);
}

export async function startSandbox(name: string): Promise<void> {
	return (await driver()).start(name);
}

export async function stopSandbox(name: string, force = true): Promise<void> {
	return (await driver()).stop(name, force);
}

export async function removeSandbox(name: string): Promise<void> {
	return (await driver()).remove(name);
}

export async function listSandboxes(): Promise<SandboxInfo[]> {
	return (await driver()).list();
}

/** Single home for running/total counts (daemon, task admission, heartbeat). */
export async function snapshotQuota(): Promise<QuotaUsage> {
	const sandboxes = await listSandboxes();
	return {
		running: sandboxes.filter((s) => s.status === "running").length,
		total: sandboxes.length,
	};
}

/** Unstreamed exec inside the sandbox (git-binding + task runs). */
export async function execInSandbox(
	name: string,
	cmd: string,
	args: string[] = [],
): Promise<ExecResult> {
	return (await driver()).exec(name, cmd, args);
}

/** Streaming exec (pipe mode, stdout/stderr separate) for execution logs. */
export async function execStreamInSandbox(
	name: string,
	cmd: string,
	args: string[] = [],
	onEvent: (stream: StreamName, data: string) => void,
): Promise<number> {
	return (await driver()).execStream(name, cmd, args, onEvent);
}

/** Per-sandbox pressure attribution; degrades to [] when the runtime is absent. */
export async function sandboxMetricsForPressure(): Promise<SandboxMetrics[]> {
	try {
		return await (await driver()).metrics();
	} catch {
		return [];
	}
}
