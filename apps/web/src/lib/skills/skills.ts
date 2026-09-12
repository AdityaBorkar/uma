/**
 * Skills — client-safe shared helpers.
 *
 * Scope is intentionally undecided (per-user registry vs per-machine
 * `desired.json`): the settings UI persists through the `SkillsStore`
 * interface below (browser `localStorage` in v1), so a server-backed
 * adapter can replace the storage helpers later without touching the page.
 *
 * Installs go through the skills.sh CLI. The canonical command uses `bunx`
 * (not `npx`). Verification runs `bunx skills add <source> --list -y`
 * server-side (`/api/skills/verify`) — it lists without installing.
 *
 * The upstream CLI has no `--version` flag, so `version` is an optional
 * metadata pin (tag/SHA, same alphabet as the machine `SkillsKey`
 * validator). It is stored and displayed, never passed to the CLI.
 * Upgrading means pulling latest via `bunx skills update <name> -y`.
 */

export interface VerifiedSkill {
	description: string;
	name: string;
}

export interface InstalledSkillEntry {
	/** Skill names reported by the last `--list` verify (may be empty). */
	availableSkills: VerifiedSkill[];
	/** Derived GitHub repo URL for the "GitHub" link button, if applicable. */
	githubUrl: string | null;
	id: string;
	installedAt: string;
	lastCheckedAt: string | null;
	/** Local display name (defaults to the repo/slug part of the source). */
	name: string;
	/** Verbatim skills.sh source spec passed to `bunx skills add`. */
	source: string;
	/** True once `/api/skills/verify` has succeeded for this source. */
	verified: boolean;
	/** Optional version pin (tag/SHA). Empty means floating latest. */
	version: string | null;
}

export interface SkillsStore {
	items: InstalledSkillEntry[];
}

export const STORAGE_KEY = "uma:skills:v1";

/** Reject only empty/oversized values and whitespace/control characters. */
export function isSafeSkillSource(source: string): boolean {
	if (source.length === 0 || source.length > 512) return false;
	for (const ch of source) {
		const code = ch.codePointAt(0) ?? 0;
		if (code <= 0x20 || code === 0x7f) return false;
	}
	return true;
}

/** Optional version pin (tag/SHA): tag/SHA/URL-ref alphabet only. */
export function isSafeSkillVersion(version: string): boolean {
	return (
		version.length > 0 &&
		version.length <= 128 &&
		/^[A-Za-z0-9._\-/:@+^~]+$/.test(version)
	);
}

const OWNER_REPO_RE =
	/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;

export type SkillSourceKind =
	| "github-shorthand"
	| "github-url"
	| "git-url"
	| "other";

/**
 * Normalize a user-pasted GitHub link into the verbatim CLI source plus a
 * derived repo URL for display. Accepts `owner/repo`, full GitHub URLs
 * (including `/tree/...` deep links), SSH/HTTPS git URLs, and anything else
 * the CLI may resolve (returned as `other` with no link).
 */
export function normalizeSkillSource(input: string): {
	githubUrl: string | null;
	kind: SkillSourceKind;
	source: string;
} {
	const source = input.trim();
	if (!source) return { githubUrl: null, kind: "other", source: "" };

	// Verbose tree/blob URLs: keep the full URL for the CLI, link the repo root.
	const treeMatch = source.match(
		/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/tree\/.*|\/blob\/.*)?\/?$/i,
	);
	if (treeMatch?.[1]) {
		return {
			githubUrl: `https://github.com/${treeMatch[1]}`,
			kind: "github-url",
			source,
		};
	}
	const repoMatch = source.match(
		/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i,
	);
	if (repoMatch?.[1]) {
		return {
			githubUrl: `https://github.com/${repoMatch[1]}`,
			kind: "github-url",
			source,
		};
	}
	if (
		/^(?:git@github\.com:|ssh:\/\/git@github\.com\/)/i.test(source) ||
		/^https?:\/\/[^/]*gitlab\.com\//i.test(source) ||
		/\.git\/?$/.test(source) ||
		/^(?:ssh:\/\/git@|git@)/i.test(source)
	) {
		const ghSsh = source.match(
			/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i,
		);
		return {
			githubUrl: ghSsh?.[1] ? `https://github.com/${ghSsh[1]}` : null,
			kind: "git-url",
			source,
		};
	}
	if (OWNER_REPO_RE.test(source)) {
		return {
			githubUrl: `https://github.com/${source}`,
			kind: "github-shorthand",
			source,
		};
	}
	return { githubUrl: null, kind: "other", source };
}

/** Default display name derived from the source (repo or slug tail). */
export function defaultNameForSource(source: string): string {
	const trimmed = source
		.trim()
		.replace(/\/+$/, "")
		.replace(/\.git$/, "");
	const treeSplit = trimmed.split("/tree/")[0] ?? trimmed;
	const parts = treeSplit.split("/");
	const tail = parts.slice(-2).join("/") || trimmed;
	return tail.replace(/^https?:\/\//, "").replace(/^git@/, "");
}

export function buildInstallCommand(
	source: string,
	opts?: { agent?: string; global?: boolean; skill?: string },
): string {
	const parts = ["bunx", "skills", "add", source];
	if (opts?.skill) parts.push("--skill", opts.skill);
	parts.push("-a", opts?.agent ?? "opencode");
	if (opts?.global !== false) parts.push("-g");
	parts.push("-y");
	return parts.join(" ");
}

export function buildVerifyCommand(source: string): string {
	return `bunx skills add ${source} --list -y`;
}

export function buildUpdateCommand(skillName: string): string {
	return `bunx skills update ${skillName} -y`;
}

export function buildRemoveCommand(skillName: string): string {
	return `bunx skills remove ${skillName} -y`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asVerifiedSkills(value: unknown): VerifiedSkill[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((v) => {
		if (!isRecord(v)) return [];
		if (typeof v.name !== "string" || !v.name.trim()) return [];
		return [
			{
				description: typeof v.description === "string" ? v.description : "",
				name: v.name.trim(),
			} satisfies VerifiedSkill,
		];
	});
}

function asEntry(value: unknown): InstalledSkillEntry | null {
	if (!isRecord(value)) return null;
	const source = typeof value.source === "string" ? value.source.trim() : "";
	const id = typeof value.id === "string" ? value.id : "";
	if (!source || !id || !isSafeSkillSource(source)) return null;
	const version =
		typeof value.version === "string" && value.version.trim() !== ""
			? value.version.trim()
			: null;
	if (version !== null && !isSafeSkillVersion(version)) return null;
	const name =
		typeof value.name === "string" && value.name.trim()
			? value.name.trim()
			: defaultNameForSource(source);
	const githubUrl =
		typeof value.githubUrl === "string" && value.githubUrl.trim()
			? value.githubUrl.trim()
			: normalizeSkillSource(source).githubUrl;
	return {
		availableSkills: asVerifiedSkills(value.availableSkills),
		githubUrl,
		id,
		installedAt: typeof value.installedAt === "string" ? value.installedAt : "",
		lastCheckedAt:
			typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : null,
		name,
		source,
		verified: value.verified === true,
		version,
	};
}

export const EMPTY_STORE: SkillsStore = { items: [] };

export function parseStore(raw: unknown): SkillsStore {
	if (typeof raw !== "string") return EMPTY_STORE;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || !Array.isArray(parsed.items)) return EMPTY_STORE;
		const seen = new Set<string>();
		const items: InstalledSkillEntry[] = [];
		for (const v of parsed.items) {
			const entry = asEntry(v);
			if (!entry || seen.has(entry.id)) continue;
			seen.add(entry.id);
			items.push(entry);
		}
		return { items };
	} catch {
		return EMPTY_STORE;
	}
}

export function loadStore(): SkillsStore {
	try {
		if (typeof window === "undefined" || !window.localStorage) {
			return EMPTY_STORE;
		}
		return parseStore(window.localStorage.getItem(STORAGE_KEY));
	} catch {
		return EMPTY_STORE;
	}
}

export function saveStore(store: SkillsStore): void {
	try {
		if (typeof window === "undefined" || !window.localStorage) return;
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Storage full or unavailable — the page keeps working in memory.
	}
}
