import { runCapture } from "../proc.ts";
import {
	type CheckResult,
	loadDesiredResult,
	maybeDryRun,
	type ResetOptions,
	type ResetResult,
} from "./desired.ts";

export const KEY = "mcp";

export async function check(): Promise<CheckResult> {
	const loaded = loadDesiredResult();
	if (loaded.status === "corrupt") {
		return {
			detail: `desired.json corrupt: ${loaded.error ?? "unreadable"}`,
			drifted: true,
			key: KEY,
		};
	}
	const servers = loaded.state.mcp?.servers ?? [];
	if (servers.length === 0)
		return { detail: "no mcp servers declared", drifted: false, key: KEY };
	// Best-effort probe: `opencode mcp list` if available, else drift if any declared
	// but no CLI to verify (report as drift with remediation).
	const r = await runCapture("opencode", ["mcp", "list"], 6000);
	if (!r)
		return {
			detail: "opencode binary missing for mcp check",
			drifted: true,
			key: KEY,
		};
	const missing = servers.filter((s) => !r.stdout.includes(s));
	if (missing.length === 0)
		return { detail: "mcp in sync", drifted: false, key: KEY };
	return {
		detail: `missing mcp: ${missing.join(",")}`,
		drifted: true,
		key: KEY,
	};
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	const dry = await maybeDryRun(opts, KEY, check);
	if (dry) return dry;
	const c = await check();
	if (!c.drifted) return { changed: false, key: KEY, ok: true };
	return {
		error: `mcp drifted: ${c.detail}. Add/remove entries via /settings/mcp instructions.`,
		key: KEY,
		ok: false,
	};
}
