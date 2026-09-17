/**
 * Skills — server-safe shared helpers (pure validation + command builders
 * only). Browser persistence lives in `apps/web` (`localStorage`); this
 * module must never touch `window`.
 *
 * Installs go through the skills.sh CLI. The canonical command uses `bunx`
 * (not `npx`). Verification runs `bunx skills add <source> --list -y`
 * server-side (`/api/skills/verify`) — it lists without installing.
 */

import { z } from "zod";

export const VerifiedSkillSchema = z.object({
	description: z.string().default(""),
	name: z.string().min(1),
});

export type VerifiedSkill = z.infer<typeof VerifiedSkillSchema>;

export const InstalledSkillEntrySchema = z.object({
	availableSkills: z.array(VerifiedSkillSchema).default([]),
	githubUrl: z.string().nullable().default(null),
	id: z.string().min(1),
	installedAt: z.string().default(""),
	lastCheckedAt: z.string().nullable().default(null),
	name: z.string().min(1),
	source: z.string().min(1).max(512),
	verified: z.boolean().default(false),
	version: z.string().nullable().default(null),
});

export type InstalledSkillEntry = z.infer<typeof InstalledSkillEntrySchema>;

export const SkillsStoreSchema = z.object({
	items: z.array(InstalledSkillEntrySchema).default([]),
});

export type SkillsStore = z.infer<typeof SkillsStoreSchema>;

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
