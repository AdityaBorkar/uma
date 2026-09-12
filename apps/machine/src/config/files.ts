import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { activeCodingAgent } from "../coding-agents/registry.ts";
import type { CodingAgentAdapter } from "../coding-agents/types.ts";
import { homeDir } from "../utils/env.ts";
import {
	assertSafeFileName,
	isSafeFileName,
	writeFile0600,
} from "../utils/fs-utils.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export class FilesKey extends BaseConfigKey {
	readonly key = "files";

	/**
	 * Agent-owned templates resolve through the coding-agent adapter (e.g.
	 * opencode.json via the OpenCode layout, mcp.json/config.yml via the omp
	 * layout); uma-owned files keep the historic layout.
	 */
	constructor(
		private readonly agent: CodingAgentAdapter = activeCodingAgent(),
	) {
		super();
	}

	targetPath(name: string): string {
		assertSafeFileName(name);
		const owned = this.agent.configFileTarget(name);
		if (owned) return owned;
		const home = homeDir();
		if (name === "cli.json") return join(home, ".config", "uma", "cli.json");
		return join(home, ".config", "uma-machine", "files", name);
	}

	private desiredTemplates(): {
		names: string[];
		templates: Record<string, string>;
	} | null {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return null;
		const templates = state.templates ?? {};
		return { names: Object.keys(templates), templates };
	}

	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const templates = state.templates ?? {};
		const names = Object.keys(templates);
		if (names.length === 0)
			return { detail: "no templates declared", drifted: false, key: this.key };
		const drifted: string[] = [];
		for (const name of names) {
			if (!isSafeFileName(name)) {
				drifted.push(`${name}: unsafe name`);
				continue;
			}
			const want = templates[name] ?? "";
			const wantHash = sha256(want);
			const p = this.targetPath(name);
			if (!existsSync(p)) {
				drifted.push(`${name}: missing`);
				continue;
			}
			try {
				const actual = readFileSync(p, "utf8");
				if (sha256(actual) !== wantHash) drifted.push(`${name}: hash mismatch`);
			} catch {
				drifted.push(`${name}: unreadable`);
			}
		}
		if (drifted.length === 0)
			return { detail: "templates in sync", drifted: false, key: this.key };
		return { detail: drifted.join("; "), drifted: true, key: this.key };
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const parsed = this.desiredTemplates();
		if (!parsed) {
			return {
				error: "desired.json corrupt: not converging",
				key: this.key,
				ok: false,
			};
		}
		const { names, templates } = parsed;
		if (names.length === 0) return { changed: false, key: this.key, ok: true };
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		try {
			let changed = false;
			for (const name of names) {
				const content = templates[name] ?? "";
				// Validate JSON templates parse (Zod validation happens server-side;
				// here we at least refuse to write invalid JSON for *.json).
				if (name.endsWith(".json")) JSON.parse(content);
				const p = this.targetPath(name);
				if (existsSync(p)) {
					try {
						if (readFileSync(p, "utf8") === content) continue;
					} catch {
						// unreadable -> overwrite below
					}
				}
				writeFile0600(p, content);
				changed = true;
			}
			return { changed, key: this.key, ok: true };
		} catch (e) {
			return {
				error: e instanceof Error ? e.message : String(e),
				key: this.key,
				ok: false,
			};
		}
	}
}

function sha256(s: string): string {
	return createHash("sha256").update(s, "utf8").digest("hex");
}
