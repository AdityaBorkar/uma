import type { SandboxInfo } from "../../orpc-contract/src/index.ts";

/** Secret ref (`--secret NAME@HOST`); value never travels through argv/config. */
export interface SecretSpec {
	/** Guest-side env var visible inside the sandbox. */
	guestVar: string;
	/** Allowed egress hosts for this secret. */
	hosts: string[];
	/** Host-side env var holding the value (exported via exportProviderEnv). */
	hostVar: string;
	/** Raw value (SDK path only; passed in-process, never argv/config). */
	value: string;
}

export interface CreateOpts {
	name: string;
	projectId: string | null;
	secrets?: SecretSpec[];
	taskId: string;
}

export interface ExecResult {
	code: number;
	stderr: string;
	stdout: string;
}

export type StreamName = "stdout" | "stderr" | "system";

export interface SandboxMetrics {
	cpu: number;
	disk: number;
	id: string;
	projectId: string | null;
}

/**
 * Sandbox port. One implementation per runtime (SDK / CLI / mock); the
 * facade in `src/sandbox.ts` selects a driver and never branches on it.
 */
export interface SandboxDriver {
	create(opts: CreateOpts): Promise<{ id: string; name: string }>;
	exec(name: string, cmd: string, args: string[]): Promise<ExecResult>;
	execStream(
		name: string,
		cmd: string,
		args: string[],
		onEvent: (stream: StreamName, data: string) => void,
	): Promise<number>;
	readonly kind: "sdk" | "cli" | "mock";
	list(): Promise<SandboxInfo[]>;
	metrics(): Promise<SandboxMetrics[]>;
	remove(name: string): Promise<void>;
	start(name: string): Promise<void>;
	stop(name: string, force: boolean): Promise<void>;
}
