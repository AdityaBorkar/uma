/**
 * MCP servers — client-safe shared helpers.
 *
 * Mirrors the opencode `mcp` config shape documented at
 * https://opencode.ai/docs/mcp-servers/ :
 *
 * - local:  `{ type: "local", command: ["npx", "-y", "pkg[@version]"], enabled }`
 * - remote: `{ type: "remote", url: "https://…/mcp", enabled }`
 *
 * Scope is intentionally local-only in v1 (browser `localStorage`).
 */

import { z } from "zod";

import { defineLocalStore } from "#/lib/local-store.ts";

export const McpKindSchema = z.enum(["local", "remote"]);
export type McpKind = z.infer<typeof McpKindSchema>;

export const McpRuntimeSchema = z.enum(["npx", "bunx", "uvx"]);
export type McpRuntime = z.infer<typeof McpRuntimeSchema>;

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const PACKAGE_RE = /^(?:@[A-Za-z0-9_.-]+\/)?[A-Za-z0-9_.-]+$/;
const VERSION_RE = /^[A-Za-z0-9._\-/:@+^~]+$/;

/** opencode `mcp` key: alnum start, letters/digits/`_`/`-`, max 64. */
export function isSafeMcpName(name: string): boolean {
	return name.length >= 1 && name.length <= 64 && NAME_RE.test(name);
}

/** npm package name (optional `@scope/` prefix), max 214, no whitespace. */
export function isSafeMcpPackage(pkg: string): boolean {
	if (pkg.length === 0 || pkg.length > 214) return false;
	if (/\s/.test(pkg)) return false;
	return PACKAGE_RE.test(pkg);
}

/** Optional version pin: tag/range/SHA alphabet, max 128. */
export function isSafeMcpVersion(version: string): boolean {
	return (
		version.length > 0 && version.length <= 128 && VERSION_RE.test(version)
	);
}

/** Remote server URL: http(s), max 2048, no whitespace. */
export function isSafeMcpUrl(url: string): boolean {
	if (url.length === 0 || url.length > 2048) return false;
	if (/\s/.test(url)) return false;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

export function isValidMcpRuntime(value: string): value is McpRuntime {
	return value === "npx" || value === "bunx" || value === "uvx";
}

export const InstalledMcpEntrySchema = z.object({
	enabled: z.boolean().default(true),
	id: z.string().min(1),
	installedAt: z.string().default(""),
	kind: McpKindSchema.default("local"),
	lastCheckedAt: z.string().nullable().default(null),
	latestVersion: z.string().nullable().default(null),
	name: z.string().min(1).max(64).refine(isSafeMcpName, "Invalid MCP name"),
	package: z.string().default(""),
	runtime: McpRuntimeSchema.default("npx"),
	url: z.string().default(""),
	version: z.string().nullable().default(null),
});

export type InstalledMcpEntry = z.infer<typeof InstalledMcpEntrySchema>;

export const McpStoreSchema = z.object({
	items: z.array(InstalledMcpEntrySchema).default([]),
});

export type McpStore = z.infer<typeof McpStoreSchema>;

export const STORAGE_KEY = "uma:mcp-servers:v1";

export const EMPTY_STORE: McpStore = { items: [] };

const storeDef = defineLocalStore(STORAGE_KEY, McpStoreSchema, EMPTY_STORE);

function dedupe(items: InstalledMcpEntry[]): InstalledMcpEntry[] {
	const seenIds = new Set<string>();
	const seenNames = new Set<string>();
	const out: InstalledMcpEntry[] = [];
	for (const entry of items) {
		if (seenIds.has(entry.id)) continue;
		// Enforce kind-specific invariants + version safety beyond the schema.
		if (entry.kind === "local") {
			if (!isSafeMcpPackage(entry.package.trim())) continue;
		} else if (!isSafeMcpUrl(entry.url.trim())) continue;
		if (entry.version !== null && !isSafeMcpVersion(entry.version.trim()))
			continue;
		if (
			entry.latestVersion !== null &&
			!isSafeMcpVersion(entry.latestVersion.trim())
		)
			continue;
		const lowered = entry.name.toLowerCase();
		if (seenNames.has(lowered)) continue;
		seenIds.add(entry.id);
		seenNames.add(lowered);
		out.push(entry);
	}
	return out;
}

export function parseStore(raw: unknown): McpStore {
	if (typeof raw !== "string") return EMPTY_STORE;
	try {
		const parsed: unknown = JSON.parse(raw);
		const result = McpStoreSchema.safeParse(parsed);
		if (!result.success) return EMPTY_STORE;
		return { items: dedupe(result.data.items) };
	} catch {
		return EMPTY_STORE;
	}
}

export function loadStore(): McpStore {
	return storeDef.load();
}

export function saveStore(store: McpStore): void {
	storeDef.save(store);
}

/** Display name derived from an npm package (`@scope/name` → `name`). */
export function defaultNameForPackage(pkg: string): string {
	const trimmed = pkg.trim().replace(/\/+$/, "");
	const tail = trimmed.split("/").pop() ?? trimmed;
	return tail.replace(/^@/, "").replace(/\s+/g, "-") || "mcp-server";
}

/** `pkg` plus an optional `@version` pin. */
export function packageRef(pkg: string, version: string | null): string {
	const clean = pkg.trim();
	if (!version || version.trim() === "") return clean;
	return `${clean}@${version.trim()}`;
}

/** Command array stored in `opencode.json` for a local entry. */
export function commandArrayFor(
	pkg: string,
	version: string | null,
	runtime: McpRuntime,
): string[] {
	return [runtime, "-y", packageRef(pkg, version)];
}

/** Shell preview of the local command array (`npx -y pkg@1.2.0`). */
export function buildRunCommand(
	pkg: string,
	version: string | null,
	runtime: McpRuntime,
): string {
	return commandArrayFor(pkg, version, runtime).join(" ");
}

/**
 * Canonical `opencode.json` snippet for one entry — paste under the
 * top-level `mcp` key.
 */
export function buildMcpJson(
	entry: Pick<
		InstalledMcpEntry,
		"enabled" | "kind" | "name" | "package" | "runtime" | "url" | "version"
	>,
): string {
	const config =
		entry.kind === "local"
			? {
					command: commandArrayFor(entry.package, entry.version, entry.runtime),
					enabled: entry.enabled,
					type: "local" as const,
				}
			: {
					enabled: entry.enabled,
					type: "remote" as const,
					url: entry.url,
				};
	return JSON.stringify({ mcp: { [entry.name]: config } }, null, 2);
}
