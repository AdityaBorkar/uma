import { dirname, join, sep } from "node:path";

import writeFileAtomic from "write-file-atomic";

import { configDir } from "../utils/env.ts";
import { ensureParentDir } from "../utils/fs-utils.ts";
import { runCapture } from "../utils/proc.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export function unitPath(): string {
	if (process.env.UMA_SYSTEMD_UNIT) return process.env.UMA_SYSTEMD_UNIT;
	// Derive from the resolved config dir so UMA_CONFIG_HOME / UMA_MACHINE_ROOT
	// / XDG overrides apply (previously XDG-only, overrides ignored). The
	// config dir is either <base>/uma-machine (strip the leaf) or an override
	// full-dir/root (use as-is).
	const cfg = configDir();
	const base = cfg.endsWith(`${sep}uma-machine`) ? dirname(cfg) : cfg;
	return join(base, "systemd", "user", "uma-machine.service");
}

/**
 * Command for ExecStart: `bun <main>` when running from source (.ts),
 * otherwise the binary itself (compiled single-file or PATH install).
 * UMA_EXEC_PATH overrides (useful in tests).
 */
export function executableCommand(): string {
	if (process.env.UMA_EXEC_PATH) return process.env.UMA_EXEC_PATH;
	const main = Bun.main ?? process.argv[1] ?? "uma-machine";
	if (main.endsWith(".ts")) return `${process.execPath} ${main}`;
	return main;
}

export function unitContent(execPath: string): string {
	return `[Unit]
Description=uma-machine device agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=${execPath} daemon
Environment=UMA_MACHINE_ROOT=${configDir()}

[Install]
WantedBy=default.target
`;
}

/** Write the user unit file (0644, no secrets). Returns the path written. */
export function writeUnitFile(execPath = executableCommand()): string {
	const p = unitPath();
	ensureParentDir(p);
	// Atomic tmp+rename like secret writes, but explicit 0644: the user unit
	// must stay world-readable for `systemctl --user` (never 0600).
	writeFileAtomic.sync(p, unitContent(execPath), { mode: 0o644 });
	return p;
}

export class SystemdKey extends BaseConfigKey {
	readonly key = "systemd";

	async check(): Promise<CheckResult> {
		const parts: string[] = [];
		const user = process.env.USER ?? process.env.LOGNAME ?? "";
		// Three independent probes (linger / is-enabled / is-active).
		const [linger, enabled, active] = await Promise.all([
			runCapture(
				"loginctl",
				["show-user", "--value", "--property=Lingering", user],
				5000,
			),
			runCapture("systemctl", ["--user", "is-enabled", "uma-machine"], 5000),
			runCapture("systemctl", ["--user", "is-active", "uma-machine"], 5000),
		]);
		if (!linger) parts.push("loginctl unavailable");
		else if (!/^yes/i.test(linger.stdout.trim()))
			parts.push("lingering not enabled");
		if (enabled?.stdout.trim() !== "enabled") parts.push("unit not enabled");
		if (active?.stdout.trim() !== "active") parts.push("unit not active");

		if (parts.length === 0)
			return { detail: "systemd ok", drifted: false, key: this.key };
		return { detail: parts.join("; "), drifted: true, key: this.key };
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		try {
			// 1. lingering (owned by check/reset/sync). Scoped to our user; rootless
			// containers without loginctl fail here and fall through to unit write.
			const user = process.env.USER ?? process.env.LOGNAME ?? "";
			const lingerArgs = user
				? ["enable-linger", user]
				: ["enable-linger"];
			await runCapture("loginctl", lingerArgs, 8000);
			// 2. write unit
			writeUnitFile();
			// 3. daemon-reload + enable --now (best-effort; fails cleanly in containers)
			await runCapture("systemctl", ["--user", "daemon-reload"], 8000);
			const en = await runCapture(
				"systemctl",
				["--user", "enable", "--now", "uma-machine"],
				10000,
			);
			if (en?.code !== 0) {
				return {
					changed: true,
					error: undefined,
					key: this.key,
					ok: true,
				};
			}
			return { changed: true, key: this.key, ok: true };
		} catch (e) {
			return {
				error: e instanceof Error ? e.message : String(e),
				key: this.key,
				ok: false,
			};
		}
	}
}
