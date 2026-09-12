import { parseKeyList } from "../utils/env.ts";
import { AgentsKey } from "./agents.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { FilesKey } from "./files.ts";
import { GitLoginKey } from "./git.ts";
import type { ConfigKey } from "./key.ts";
import { McpKey } from "./mcp.ts";
import { ProgramsKey } from "./programs.ts";
import { ProvidersKey } from "./providers.ts";
import { SkillsKey } from "./skills.ts";
import { SystemdKey } from "./systemd.ts";

export type { CheckResult, ConfigKey, ResetOptions, ResetResult };

/** Dependency order from §7: programs -> git -> agents -> files -> providers -> mcp -> skills -> systemd */
export const ORDERED_KEYS: ConfigKey[] = [
	new ProgramsKey(),
	new GitLoginKey(),
	new AgentsKey(),
	new FilesKey(),
	new ProvidersKey(),
	new McpKey(),
	new SkillsKey(),
	new SystemdKey(),
];

export function resolveKeys(only?: string[]): ConfigKey[] {
	if (!only || only.length === 0) return ORDERED_KEYS;
	const wanted = new Set(only.flatMap((s) => parseKeyList(s)));
	// Allow alias "sync" for skills module key "skills".
	return ORDERED_KEYS.filter(
		(m) => wanted.has(m.key) || (m.key === "skills" && wanted.has("sync")),
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
				key: m.key,
			});
		}
	}
	return out;
}

export async function resetAll(
	opts?: ResetOptions & { only?: string[] | undefined },
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
				key: m.key,
				ok: false,
			});
		}
	}
	return out;
}
