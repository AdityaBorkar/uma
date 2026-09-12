import type { Limits, QuotaUsage, SandboxInfo } from "@uma/orpc-contract";

import { type DriverSelector, defaultSelector } from "./msb/driver.ts";
import type {
	CreateOpts,
	ExecResult,
	SandboxMetrics,
	StreamName,
} from "./msb/types.ts";

export { DriverSelector, defaultSelector } from "./msb/driver.ts";
export type {
	CreateOpts,
	ExecResult,
	SecretSpec,
	StreamName,
} from "./msb/types.ts";

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
// Sandbox handle (class-based port; SDK → CLI → mock selection lives in
// sandboxes/msb/driver.ts via an injected DriverSelector)
// ---------------------------------------------------------------------------

/**
 * Handle to one sandbox. `new Sandbox(name)` addresses an existing sandbox;
 * `Sandbox.create(opts)` provisions one and returns its handle. Lifecycle and
 * exec calls bind to the instance so callers stop threading names around.
 * Driver selection goes through the injected `DriverSelector` (defaults to the
 * process-wide `defaultSelector`); pass a fresh selector in tests.
 */
export class Sandbox {
	/** Driver sandbox name (primary key for all driver ops). */
	readonly name: string;
	/** Runtime id when known from create; equals name for CLI/mock drivers. */
	readonly id: string;
	private readonly selector: DriverSelector;

	constructor(
		name: string,
		id?: string,
		selector: DriverSelector = defaultSelector,
	) {
		this.name = name;
		this.id = id ?? name;
		this.selector = selector;
	}

	/** Provision a sandbox and return its handle. Quota admission is the caller's job (snapshotQuota + quotaPreCheck). */
	static async create(
		opts: CreateOpts,
		selector: DriverSelector = defaultSelector,
	): Promise<Sandbox> {
		validateSandboxName(opts.name);
		const driver = await selector.resolve();
		const { id } = await driver.create(opts);
		return new Sandbox(opts.name, id, selector);
	}

	static async list(
		selector: DriverSelector = defaultSelector,
	): Promise<SandboxInfo[]> {
		return (await selector.resolve()).list();
	}

	/** Per-sandbox pressure attribution; degrades to [] when the runtime is absent. */
	static async metricsForPressure(
		selector: DriverSelector = defaultSelector,
	): Promise<SandboxMetrics[]> {
		try {
			return await (await selector.resolve()).metrics();
		} catch {
			return [];
		}
	}

	async start(): Promise<void> {
		return (await this.selector.resolve()).start(this.name);
	}

	async stop(force = true): Promise<void> {
		return (await this.selector.resolve()).stop(this.name, force);
	}

	async remove(): Promise<void> {
		return (await this.selector.resolve()).remove(this.name);
	}

	/** Unstreamed exec inside the sandbox (git-binding + task runs). */
	async exec(cmd: string, args: string[] = []): Promise<ExecResult> {
		return (await this.selector.resolve()).exec(this.name, cmd, args);
	}

	/** Streaming exec (pipe mode, stdout/stderr separate) for execution logs. */
	async execStream(
		cmd: string,
		args: string[],
		onEvent: (stream: StreamName, data: string) => void,
	): Promise<number> {
		return (await this.selector.resolve()).execStream(
			this.name,
			cmd,
			args,
			onEvent,
		);
	}
}

/** Single home for running/total counts (daemon, task admission, heartbeat). */
export async function snapshotQuota(
	selector: DriverSelector = defaultSelector,
): Promise<QuotaUsage> {
	const sandboxes = await Sandbox.list(selector);
	return {
		running: sandboxes.filter((s) => s.status === "running").length,
		total: sandboxes.length,
	};
}
