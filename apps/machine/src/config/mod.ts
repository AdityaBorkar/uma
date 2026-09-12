import { parseKeyList } from "../utils/env.ts";
import * as adityabAgent from "./adityab-agent.ts";
import * as agents from "./agents.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import * as files from "./files.ts";
import * as git from "./git.ts";
import * as mcp from "./mcp.ts";
import * as programs from "./programs.ts";
import * as providers from "./providers.ts";
import * as skills from "./skills.ts";
import * as systemd from "./systemd.ts";

export type { CheckResult, ResetOptions, ResetResult };

interface KeyModule {
	check: () => Promise<CheckResult>;
	KEY: string;
	reset: (opts?: ResetOptions) => Promise<ResetResult>;
}

/** Dependency order from §7: programs -> git -> adityab-agent -> agents -> files -> providers -> mcp -> skills -> systemd */
export const ORDERED_KEYS = [
	programs,
	git,
	adityabAgent,
	agents,
	files,
	providers,
	mcp,
	skills,
	systemd,
] satisfies KeyModule[];

export function resolveKeys(only?: string[]): KeyModule[] {
	if (!only || only.length === 0) return ORDERED_KEYS;
	const wanted = new Set(only.flatMap((s) => parseKeyList(s)));
	// Allow alias "sync" for skills module key "skills".
	return ORDERED_KEYS.filter(
		(m) => wanted.has(m.KEY) || (m.KEY === "skills" && wanted.has("sync")),
	);
}

export async function checkAll(only?: string[]): Promise<CheckResult[]> {
	const mods = resolveKeys(only);
	const out: CheckResult[] = [];
	for (const m of mods) {
		try {
			out.push(await m.check());
		} catch (e) {
			out.push({
				detail: e instanceof Error ? e.message : String(e),
				drifted: true,
				key: m.KEY,
			});
		}
	}
	return out;
}

export async function resetAll(
	opts?: ResetOptions & { only?: string[] },
): Promise<ResetResult[]> {
	const mods = resolveKeys(opts?.only);
	const out: ResetResult[] = [];
	for (const m of mods) {
		try {
			// Providers payload flows through; other keys ignore it.
			out.push(await m.reset(opts));
		} catch (e) {
			out.push({
				error: e instanceof Error ? e.message : String(e),
				key: m.KEY,
				ok: false,
			});
		}
	}
	return out;
}
