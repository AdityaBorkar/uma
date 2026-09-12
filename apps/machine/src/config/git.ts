import { runCapture } from "../utils/proc.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";

export const KEY = "git-login";

export async function check(): Promise<CheckResult> {
	const r = await runCapture("gh", ["auth", "status"], 8000);
	if (!r) return { detail: "gh binary missing", drifted: true, key: KEY };
	if (r.code !== 0) {
		return {
			detail: `gh auth status failed: ${(r.stderr || r.stdout).slice(0, 300)}`,
			drifted: true,
			key: KEY,
		};
	}
	return { detail: "gh authenticated", drifted: false, key: KEY };
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	if (opts?.dryRun) {
		const c = await check();
		return {
			changed: c.drifted,
			error: c.drifted ? `would need: ${c.detail}` : undefined,
			key: KEY,
			ok: true,
		};
	}
	const c = await check();
	if (!c.drifted) return { changed: false, key: KEY, ok: true };
	return {
		error:
			`git login drifted: ${c.detail}. Remediation: run 'gh auth login' ` +
			`or provide a Connections token via server UI. Token never logged.`,
		key: KEY,
		ok: false,
	};
}
