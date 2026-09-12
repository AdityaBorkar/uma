import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { isSafeFileName, writeFile0600 } from "../utils/fs-utils.ts";
import {
	type CheckResult,
	loadDesiredResult,
	maybeDryRun,
	type ResetOptions,
	type ResetResult,
} from "./desired.ts";

export const KEY = "skills";

function skillsDir(): string {
	const home = process.env.UMA_HOME ?? homedir();
	return join(home, ".config", "uma-machine", "skills");
}

function manifestHash(files: string[]): string {
	return createHash("sha256")
		.update(
			[...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join("\n"),
			"utf8",
		)
		.digest("hex");
}

function localFiles(): string[] {
	const dir = skillsDir();
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir)
			.filter((f) => !f.startsWith("."))
			.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	} catch {
		return [];
	}
}

function declaredSkills(): string[] | null {
	const loaded = loadDesiredResult();
	if (loaded.status === "corrupt") return null;
	return loaded.state.skills?.files ?? [];
}

export async function check(): Promise<CheckResult> {
	const loaded = loadDesiredResult();
	if (loaded.status === "corrupt") {
		return {
			detail: `desired.json corrupt: ${loaded.error ?? "unreadable"}`,
			drifted: true,
			key: KEY,
		};
	}
	const want = loaded.state.skills?.files ?? [];
	if (want.length === 0)
		return { detail: "no skills declared", drifted: false, key: KEY };
	const unsafe = want.filter((w) => !isSafeFileName(w));
	if (unsafe.length > 0) {
		return {
			detail: `unsafe skill names: ${unsafe.join(",")}`,
			drifted: true,
			key: KEY,
		};
	}
	const have = localFiles();
	const wh = manifestHash(want);
	const hh = manifestHash(have);
	if (wh === hh) return { detail: "skills in sync", drifted: false, key: KEY };
	const missing = want.filter((w) => !have.includes(w));
	const extra = have.filter((h) => !want.includes(h));
	const parts: string[] = [];
	if (missing.length > 0) parts.push(`missing: ${missing.join(",")}`);
	if (extra.length > 0) parts.push(`extra: ${extra.join(",")}`);
	return {
		detail: parts.join("; ") || "manifest mismatch",
		drifted: true,
		key: KEY,
	};
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	const want = declaredSkills();
	if (!want) {
		return {
			error: "desired.json corrupt: not converging",
			key: KEY,
			ok: false,
		};
	}
	if (want.length === 0) return { changed: false, key: KEY, ok: true };
	for (const w of want) {
		if (!isSafeFileName(w)) {
			return {
				error: `unsafe skill name: ${JSON.stringify(w)}`,
				key: KEY,
				ok: false,
			};
		}
	}
	const dry = await maybeDryRun(opts, KEY, check);
	if (dry) return dry;
	try {
		const dir = skillsDir();
		mkdirSync(dir, { recursive: true });
		const have = new Set(localFiles());
		let changed = false;
		for (const w of want) {
			if (!have.has(w)) {
				// Placeholder converge: create stub manifest entry. Real content
				// comes from /settings/skills sync; we never fabricate skill bodies.
				writeFile0600(join(dir, w), `# skill ${w}\n# synced by uma-machine\n`);
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
		return { changed, key: KEY, ok: true };
	} catch (e) {
		return {
			error: e instanceof Error ? e.message : String(e),
			key: KEY,
			ok: false,
		};
	}
}
