import { whichBin } from "../utils/proc.ts";
import {
	type CheckResult,
	loadDesiredResult,
	maybeDryRun,
	type ResetOptions,
	type ResetResult,
} from "./desired.ts";

export const KEY = "agents";

export async function check(): Promise<CheckResult> {
	const loaded = loadDesiredResult();
	if (loaded.status === "corrupt") {
		return {
			detail: `desired.json corrupt: ${loaded.error ?? "unreadable"}`,
			drifted: true,
			key: KEY,
		};
	}
	const bins = loaded.state.agents?.bins ?? [];
	if (bins.length === 0)
		return { detail: "no agents declared", drifted: false, key: KEY };
	const found = await Promise.all(
		bins.map(async (b) => ({ b, path: await whichBin(b) })),
	);
	const missing = found.filter((f) => !f.path).map((f) => f.b);
	if (missing.length > 0) {
		return {
			detail: `missing agents: ${missing.join(",")}`,
			drifted: true,
			key: KEY,
		};
	}
	return {
		detail: `agents present: ${bins.join(",")}`,
		drifted: false,
		key: KEY,
	};
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	const dry = await maybeDryRun(opts, KEY, check);
	if (dry) return dry;
	const c = await check();
	if (!c.drifted) return { changed: false, key: KEY, ok: true };
	return {
		error: `agents drifted: ${c.detail}. Install via /settings/agents instructions.`,
		key: KEY,
		ok: false,
	};
}
