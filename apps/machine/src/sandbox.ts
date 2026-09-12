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
// Sandbox handle (class-based port; SDK → CLI → mock selection lives in sandboxes/msb/driver.ts)
// ---------------------------------------------------------------------------

/**
 * Handle to one sandbox. `new Sandbox(name)` addresses an existing sandbox;
 * `Sandbox.create(opts)` provisions one and returns its handle. Lifecycle and
 * exec calls bind to the instance so callers stop threading names around.
 */
export class Sandbox {
	/** Driver sandbox name (primary key for all driver ops). */
	readonly name: string;
	/** Runtime id when known from create; equals name for CLI/mock drivers. */
	readonly id: string;

	constructor(name: string, id?: string) {
		this.name = name;
		this.id = id ?? name;
	}

	/** Provision a sandbox and return its handle. Quota admission is the caller's job (snapshotQuota + quotaPreCheck). */
	static async create(opts: CreateOpts): Promise<Sandbox> {
		validateSandboxName(opts.name);
		const { id } = await (await driver()).create(opts);
		return new Sandbox(opts.name, id);
	}

	static async list(): Promise<SandboxInfo[]> {
		return (await driver()).list();
	}

	/** Per-sandbox pressure attribution; degrades to [] when the runtime is absent. */
	static async metricsForPressure(): Promise<SandboxMetrics[]> {
		try {
			return await (await driver()).metrics();
		} catch {
			return [];
		}
	}

	async start(): Promise<void> {
		return (await driver()).start(this.name);
	}

	async stop(force = true): Promise<void> {
		return (await driver()).stop(this.name, force);
	}

	async remove(): Promise<void> {
		return (await driver()).remove(this.name);
	}

	/** Unstreamed exec inside the sandbox (git-binding + task runs). */
	async exec(cmd: string, args: string[] = []): Promise<ExecResult> {
		return (await driver()).exec(this.name, cmd, args);
	}

	/** Streaming exec (pipe mode, stdout/stderr separate) for execution logs. */
	async execStream(
		cmd: string,
		args: string[],
		onEvent: (stream: StreamName, data: string) => void,
	): Promise<number> {
		return (await driver()).execStream(this.name, cmd, args, onEvent);
	}
}

/** Single home for running/total counts (daemon, task admission, heartbeat). */
export async function snapshotQuota(): Promise<QuotaUsage> {
	const sandboxes = await Sandbox.list();
	return {
		running: sandboxes.filter((s) => s.status === "running").length,
		total: sandboxes.length,
	};
}

// ---------------------------------------------------------------------------
// Deprecated function facade — thin delegates kept for existing callers/tests.
// Prefer the Sandbox class.
// ---------------------------------------------------------------------------

export async function createSandbox(
	opts: CreateOpts,
): Promise<{ name: string; id: string }> {
	return Sandbox.create(opts);
}

export async function startSandbox(name: string): Promise<void> {
	return new Sandbox(name).start();
}

export async function stopSandbox(name: string, force = true): Promise<void> {
	return new Sandbox(name).stop(force);
}

export async function removeSandbox(name: string): Promise<void> {
	return new Sandbox(name).remove();
}

export async function listSandboxes(): Promise<SandboxInfo[]> {
	return Sandbox.list();
}

export async function execInSandbox(
	name: string,
	cmd: string,
	args: string[] = [],
): Promise<ExecResult> {
	return new Sandbox(name).exec(cmd, args);
}

export async function execStreamInSandbox(
	name: string,
	cmd: string,
	args: string[] = [],
	onEvent: (stream: StreamName, data: string) => void,
): Promise<number> {
	return new Sandbox(name).execStream(cmd, args, onEvent);
}

export async function sandboxMetricsForPressure(): Promise<SandboxMetrics[]> {
	return Sandbox.metricsForPressure();
}
