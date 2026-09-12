import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { homeDir } from "../utils/env.ts";
import { isSafeFileName, writeFile0600 } from "../utils/fs-utils.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export class SkillsKey extends BaseConfigKey {
	readonly key = "skills";

	private skillsDir(): string {
		return join(homeDir(), ".config", "uma-machine", "skills");
	}

	private localFiles(): string[] {
		const dir = this.skillsDir();
		if (!existsSync(dir)) return [];
		try {
			return readdirSync(dir)
				.filter((f) => !f.startsWith("."))
				.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		} catch {
			return [];
		}
	}

	private declaredSkills(): string[] | null {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return null;
		return state.skills?.files ?? [];
	}

	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const want = state.skills?.files ?? [];
		if (want.length === 0)
			return { detail: "no skills declared", drifted: false, key: this.key };
		const unsafe = want.filter((w) => !isSafeFileName(w));
		if (unsafe.length > 0) {
			return {
				detail: `unsafe skill names: ${unsafe.join(",")}`,
				drifted: true,
				key: this.key,
			};
		}
		const have = this.localFiles();
		const wh = manifestHash(want);
		const hh = manifestHash(have);
		if (wh === hh)
			return { detail: "skills in sync", drifted: false, key: this.key };
		const missing = want.filter((w) => !have.includes(w));
		const extra = have.filter((h) => !want.includes(h));
		const parts: string[] = [];
		if (missing.length > 0) parts.push(`missing: ${missing.join(",")}`);
		if (extra.length > 0) parts.push(`extra: ${extra.join(",")}`);
		return {
			detail: parts.join("; ") || "manifest mismatch",
			drifted: true,
			key: this.key,
		};
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const want = this.declaredSkills();
		if (!want) {
			return {
				error: "desired.json corrupt: not converging",
				key: this.key,
				ok: false,
			};
		}
		if (want.length === 0) return { changed: false, key: this.key, ok: true };
		for (const w of want) {
			if (!isSafeFileName(w)) {
				return {
					error: `unsafe skill name: ${JSON.stringify(w)}`,
					key: this.key,
					ok: false,
				};
			}
		}
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		try {
			const dir = this.skillsDir();
			mkdirSync(dir, { recursive: true });
			const have = new Set(this.localFiles());
			let changed = false;
			for (const w of want) {
				if (!have.has(w)) {
					// Placeholder converge: create stub manifest entry. Real content
					// comes from /settings/skills sync; we never fabricate skill bodies.
					writeFile0600(
						join(dir, w),
						`# skill ${w}\n# synced by uma-machine\n`,
					);
					changed = true;
				}
			}
			if (opts?.prune) {
				for (const h of have) {
					if (!want.includes(h)) {
						rmSync(join(dir, h), { force: true });
						changed = true;
					}
				}
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

function manifestHash(files: string[]): string {
	return createHash("sha256")
		.update(
			[...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join("\n"),
			"utf8",
		)
		.digest("hex");
}
