import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
	assertSafeFileName,
	isSafeFileName,
	writeFile0600,
} from "../fs-utils.ts";
import {
	type CheckResult,
	loadDesiredResult,
	maybeDryRun,
	type ResetOptions,
	type ResetResult,
} from "./desired.ts";

export const KEY = "files";

function sha256(s: string): string {
	return createHash("sha256").update(s, "utf8").digest("hex");
}

function targetPath(name: string): string {
	// opencode.json / cli.json live in the user home or cwd config; resolve
	// relative to $HOME for determinism in tests via UMA_HOME override.
	assertSafeFileName(name);
	const home = process.env.UMA_HOME ?? homedir();
	if (name === "opencode.json")
		return join(home, ".config", "opencode", "opencode.json");
	if (name === "cli.json") return join(home, ".config", "uma", "cli.json");
	return join(home, ".config", "uma-machine", "files", name);
}

function desiredTemplates(): {
	names: string[];
	templates: Record<string, string>;
} | null {
	const loaded = loadDesiredResult();
	if (loaded.status === "corrupt") return null;
	const templates = loaded.state.templates ?? {};
	return { names: Object.keys(templates), templates };
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
	const templates = loaded.state.templates ?? {};
	const names = Object.keys(templates);
	if (names.length === 0)
		return { detail: "no templates declared", drifted: false, key: KEY };
	const drifted: string[] = [];
	for (const name of names) {
		if (!isSafeFileName(name)) {
			drifted.push(`${name}: unsafe name`);
			continue;
		}
		const want = templates[name] ?? "";
		const wantHash = sha256(want);
		const p = targetPath(name);
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
		return { detail: "templates in sync", drifted: false, key: KEY };
	return { detail: drifted.join("; "), drifted: true, key: KEY };
}

export async function reset(opts?: ResetOptions): Promise<ResetResult> {
	const parsed = desiredTemplates();
	if (!parsed) {
		return {
			error: "desired.json corrupt: not converging",
			key: KEY,
			ok: false,
		};
	}
	const { names, templates } = parsed;
	if (names.length === 0) return { changed: false, key: KEY, ok: true };
	const dry = await maybeDryRun(opts, KEY, check);
	if (dry) return dry;
	try {
		let changed = false;
		for (const name of names) {
			const content = templates[name] ?? "";
			// Validate JSON templates parse (Zod validation happens server-side;
			// here we at least refuse to write invalid JSON for *.json).
			if (name.endsWith(".json")) JSON.parse(content);
			const p = targetPath(name);
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
		return { changed, key: KEY, ok: true };
	} catch (e) {
		return {
			error: e instanceof Error ? e.message : String(e),
			key: KEY,
			ok: false,
		};
	}
}
