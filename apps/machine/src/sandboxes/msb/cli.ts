import type { SandboxInfo } from "@uma/orpc-contract";
import {
	TASK_CPUS,
	TASK_MAX_CPUS,
	TASK_MAX_MEMORY_MB,
	TASK_MEMORY_MB,
	UBUNTU_IMAGE,
} from "@uma/orpc-contract";

import {
	isNotFoundError,
	mapStatus,
	projectIdFromLabels,
	runCli,
	taskIdFromLabels,
} from "./shared.ts";
import type {
	CreateOpts,
	ExecResult,
	SandboxDriver,
	SandboxMetrics,
} from "./types.ts";

/** `msb -m` accepts size strings; keep 1024 => "1G" shape from constants. */
function memoryArg(mb: number): string {
	return mb % 1024 === 0 ? `${mb / 1024}G` : `${mb}M`;
}

/**
 * SandboxDriver over the `msb` CLI (pipe mode; true streaming is SDK-only).
 * Stateless — every op spawns a fresh `msb` invocation.
 */
export class MsbCliDriver implements SandboxDriver {
	readonly kind = "cli" as const;

	async create(opts: CreateOpts): Promise<{ id: string; name: string }> {
		const args = [
			"create",
			UBUNTU_IMAGE,
			"-n",
			opts.name,
			"-c",
			String(TASK_CPUS),
			"-m",
			memoryArg(TASK_MEMORY_MB),
			"--max-cpus",
			String(TASK_MAX_CPUS),
			"--max-memory",
			memoryArg(TASK_MAX_MEMORY_MB),
			"--label",
			`task.id=${opts.taskId}`,
			"--label",
			`project.id=${opts.projectId ?? "global"}`,
		];
		for (const s of opts.secrets ?? []) {
			if (s.hosts.length === 0 || !s.hostVar) continue;
			args.push("--secret", `${s.hostVar}@${s.hosts.join(",")}`);
		}
		const r = await runCli(args);
		if (r.code !== 0)
			throw new Error(
				`msb create failed: ${(r.stderr || r.stdout).slice(0, 300)}`,
			);
		return { id: opts.name, name: opts.name };
	}

	async exec(name: string, cmd: string, args: string[]): Promise<ExecResult> {
		// `msb exec <name> -- <cmd>...` (pipe mode).
		const r = await runCli(["exec", name, "--", cmd, ...args], 120000);
		return { code: r.code, stderr: r.stderr, stdout: r.stdout };
	}

	async execStream(
		name: string,
		cmd: string,
		args: string[],
		onEvent: (stream: "stdout" | "stderr" | "system", data: string) => void,
	): Promise<number> {
		// CLI captures stdout/stderr separately; true streaming is SDK-only.
		const r = await this.exec(name, cmd, args);
		if (r.stdout) onEvent("stdout", r.stdout);
		if (r.stderr) onEvent("stderr", r.stderr);
		return r.code;
	}

	async list(): Promise<SandboxInfo[]> {
		const r = await runCli(["list", "--format", "json"]);
		if (r.code !== 0)
			throw new Error(
				`msb list failed: ${(r.stderr || r.stdout).slice(0, 200)}`,
			);
		const parsed: unknown = JSON.parse(r.stdout);
		const arr = Array.isArray(parsed)
			? parsed
			: ((parsed as { sandboxes?: unknown[] }).sandboxes ?? []);
		if (!Array.isArray(arr)) throw new Error("msb list: unexpected JSON shape");
		return (
			arr as {
				name?: string;
				id?: string;
				status?: string;
				labels?: Record<string, string>;
				taskId?: string | null;
				projectId?: string | null;
			}[]
		).map((e) => ({
			id: String(e.name ?? e.id ?? "unknown"),
			projectId: projectIdFromLabels(e.labels, e.projectId),
			status: mapStatus(String(e.status ?? "stopped")),
			taskId: taskIdFromLabels(e.labels, e.taskId),
		}));
	}

	async metrics(): Promise<SandboxMetrics[]> {
		return [];
	}

	async remove(name: string): Promise<void> {
		// Reap = `msb remove --force` (rm --force).
		const r = await runCli(["remove", "--force", name]);
		if (r.code !== 0 && !isNotFoundError(r.stderr || r.stdout)) {
			throw new Error(
				`msb remove failed: ${(r.stderr || r.stdout).slice(0, 300)}`,
			);
		}
	}

	async start(name: string): Promise<void> {
		const r = await runCli(["start", name]);
		if (r.code !== 0)
			throw new Error(
				`msb start failed: ${(r.stderr || r.stdout).slice(0, 300)}`,
			);
	}

	async stop(name: string, force: boolean): Promise<void> {
		// Cancel = `msb stop --force` (10s grace default, -t escalation).
		const args = force ? ["stop", "--force", name] : ["stop", name];
		const r = await runCli(args);
		// Already-gone is idempotent success; anything else is a real failure.
		if (r.code !== 0 && !isNotFoundError(r.stderr || r.stdout)) {
			throw new Error(
				`msb stop failed: ${(r.stderr || r.stdout).slice(0, 300)}`,
			);
		}
	}
}
