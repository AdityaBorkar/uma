import { coerce, satisfies, valid } from "semver";

import { runCapture, whichBin } from "../utils/proc.ts";
import {
	type CheckResult,
	maybeDryRun,
	type ResetOptions,
	type ResetResult,
} from "./desired.ts";

export const KEY = "adityab-agent";
const PINNED = process.env.UMA_ADITYAB_AGENT_PIN ?? "0.1.0";

/** Extract a semver from free-form `version` output (e.g. "adityab-agent 0.1.0"). */
function extractVersion(ver: string): string | null {
	const t = ver.trim();
	return valid(t) ?? coerce(t)?.version ?? null;
}

/** True when installed version satisfies the pin (exact version or range). */
export function pinSatisfied(ver: string, pin: string): boolean {
	if (pin === "latest") return true;
	const v = extractVersion(ver);
	if (!v) return ver.includes(pin);
	try {
		return satisfies(v, pin);
	} catch {
		return ver.includes(pin);
	}
}

export async function check(): Promise<CheckResult> {
	const p = await whichBin("adityab-agent");
	if (!p)
		return { detail: "adityab-agent not on PATH", drifted: true, key: KEY };
	const r = await runCapture("adityab-agent", ["version"], 5000);
	const ver = (r?.stdout || r?.stderr || "").trim().slice(0, 100);
	if (!pinSatisfied(ver, PINNED)) {
		return {
			detail: `adityab-agent version '${ver}' != pinned '${PINNED}'`,
			drifted: true,
			key: KEY,
		};
	}
	return { detail: `adityab-agent ${ver}`, drifted: false, key: KEY };
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	const dry = await maybeDryRun(opts, KEY, check);
	if (dry) return dry;
	const c = await check();
	if (!c.drifted) return { changed: false, key: KEY, ok: true };
	return {
		error: `adityab-agent drifted: ${c.detail}. Upgrade to pinned ref ${PINNED} per /settings/agents.`,
		key: KEY,
		ok: false,
	};
}
