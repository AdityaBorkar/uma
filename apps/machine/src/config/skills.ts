import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { homeDir } from "../utils/env.ts";
import { isSafeFileName, writeFile0600 } from "../utils/fs-utils.ts";
import type {
	CheckResult,
	ResetOptions,
	ResetResult,
	SkillRef,
} from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

/**
 * Source is stored verbatim (skills.sh `owner/skill` slug or pack URL) and
 * never interpreted here. Reject only empty/oversized values and whitespace
 * or control characters; the future installer validates resolvability.
 */
function isSafeSkillSource(source: string): boolean {
	if (source.length === 0 || source.length > 512) return false;
	for (const ch of source) {
		const code = ch.codePointAt(0) ?? 0;
		if (code <= 0x20 || code === 0x7f) return false;
	}
	return true;
}

/**
 * Optional version pin (tag/SHA). Stored as-is and interpreted later by the
 * installer; reject only empty/oversized values and characters outside the
 * tag/SHA/URL-ref alphabet.
 */
function isSafeSkillVersion(version: string): boolean {
	return (
		version.length > 0 &&
		version.length <= 128 &&
		/^[A-Za-z0-9._\-/:@+^~]+$/.test(version)
	);
}

function duplicateNames(skills: SkillRef[]): string[] {
	const seen = new Set<string>();
	const dupes = new Set<string>();
	for (const s of skills) {
		if (seen.has(s.name)) dupes.add(s.name);
		else seen.add(s.name);
	}
	return [...dupes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

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

	private declaredSkills(): SkillRef[] | null {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return null;
		return state.skills?.skills ?? [];
	}

	/** Shared declaration validation; null means valid. */
	private invalidDetail(want: SkillRef[]): string | null {
		const unsafeNames = want.filter((w) => !isSafeFileName(w.name));
		if (unsafeNames.length > 0) {
			return `unsafe skill names: ${unsafeNames.map((w) => w.name).join(",")}`;
		}
		const unsafeSources = want.filter((w) => !isSafeSkillSource(w.source));
		if (unsafeSources.length > 0) {
			return `unsafe skill sources: ${unsafeSources.map((w) => w.name).join(",")}`;
		}
		const unsafeVersions = want.filter(
			(w) => w.version !== undefined && !isSafeSkillVersion(w.version),
		);
		if (unsafeVersions.length > 0) {
			return `unsafe skill versions: ${unsafeVersions.map((w) => w.name).join(",")}`;
		}
		const dupes = duplicateNames(want);
		if (dupes.length > 0) {
			return `duplicate skill names: ${dupes.join(",")}`;
		}
		return null;
	}

	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const want = state.skills?.skills ?? [];
		if (want.length === 0)
			return { detail: "no skills declared", drifted: false, key: this.key };
		const invalid = this.invalidDetail(want);
		if (invalid) {
			return { detail: invalid, drifted: true, key: this.key };
		}
		const names = want.map((w) => w.name);
		const have = this.localFiles();
		const wh = manifestHash(names);
		const hh = manifestHash(have);
		if (wh === hh)
			return { detail: "skills in sync", drifted: false, key: this.key };
		const missing = names.filter((n) => !have.includes(n));
		const extra = have.filter((h) => !names.includes(h));
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
		const invalid = this.invalidDetail(want);
		if (invalid) {
			return { error: invalid, key: this.key, ok: false };
		}
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		try {
			const dir = this.skillsDir();
			mkdirSync(dir, { recursive: true });
			const have = new Set(this.localFiles());
			const wanted = new Set(want.map((w) => w.name));
			let changed = false;
			for (const w of want) {
				if (!have.has(w.name)) {
					// Placeholder converge: create stub manifest entry. Real content
					// comes from the future skills.sh installer; we never fabricate
					// skill bodies.
					const lines = [`# skill ${w.name}`, `# source ${w.source}`];
					if (w.version !== undefined) lines.push(`# version ${w.version}`);
					lines.push("# synced by uma-machine", "");
					writeFile0600(join(dir, w.name), `${lines.join("\n")}`);
					changed = true;
				}
			}
			if (opts?.prune) {
				for (const h of have) {
					if (!wanted.has(h)) {
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
