/**
 * MCP servers — client-safe shared helpers.
 *
 * Mirrors the opencode `mcp` config shape documented at
 * https://opencode.ai/docs/mcp-servers/ :
 *
 * - local:  `{ type: "local", command: ["npx", "-y", "pkg[@version]"], enabled }`
 * - remote: `{ type: "remote", url: "https://…/mcp", enabled }`
 *
 * Scope is intentionally local-only in v1 (browser `localStorage` via the
 * `McpStore` interface below), so a server-backed adapter can replace the
 * storage helpers later without touching the page — same pattern as
 * `#/lib/skills/skills.ts`.
 *
 * Version pins:
 * - local: appended to the npm package ref (`pkg@1.2.3`). Empty means
 *   floating latest. Latest is resolved via `GET /api/mcp/versions`.
 * - remote: stored as metadata only (there is no registry to resolve);
 *   upgrading means editing the pin by hand.
 */

export type McpKind = "local" | "remote";
export type McpRuntime = "npx" | "bunx" | "uvx";

export interface InstalledMcpEntry {
	enabled: boolean;
	/** Unique row id (crypto.randomUUID). */
	id: string;
	installedAt: string;
	kind: McpKind;
	lastCheckedAt: string | null;
	/** Last resolved `latest` from the npm registry (local only). */
	latestVersion: string | null;
	/** Unique opencode `mcp` key, e.g. `mcp_everything`. */
	name: string;
	/** npm package for local servers (empty for remote). */
	package: string;
	/** Launcher for local servers. */
	runtime: McpRuntime;
	/** Server URL for remote servers (empty for local). */
	url: string;
	/** Optional version pin (tag/range). Empty means floating latest. */
	version: string | null;
}

export interface McpStore {
	items: InstalledMcpEntry[];
}

export const STORAGE_KEY = "uma:mcp-servers:v1";

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asEntry(value: unknown): InstalledMcpEntry | null {
	if (!isRecord(value)) return null;
	const id = typeof value.id === "string" ? value.id : "";
	const rawName = typeof value.name === "string" ? value.name.trim() : "";
	if (!id || !isSafeMcpName(rawName)) return null;
	const kind = value.kind === "remote" ? "remote" : "local";
	const runtime =
		typeof value.runtime === "string" && isValidMcpRuntime(value.runtime)
			? value.runtime
			: "npx";
	if (kind === "local") {
		const pkg = typeof value.package === "string" ? value.package.trim() : "";
		if (!isSafeMcpPackage(pkg)) return null;
	} else {
		const url = typeof value.url === "string" ? value.url.trim() : "";
		if (!isSafeMcpUrl(url)) return null;
	}
	const version =
		typeof value.version === "string" && value.version.trim() !== ""
			? value.version.trim()
			: null;
	if (version !== null && !isSafeMcpVersion(version)) return null;
	const latestVersion =
		typeof value.latestVersion === "string" &&
		value.latestVersion.trim() !== "" &&
		isSafeMcpVersion(value.latestVersion.trim())
			? value.latestVersion.trim()
			: null;
	return {
		enabled: value.enabled !== false,
		id,
		installedAt: typeof value.installedAt === "string" ? value.installedAt : "",
		kind,
		lastCheckedAt:
			typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : null,
		latestVersion,
		name: rawName,
		package: typeof value.package === "string" ? value.package.trim() : "",
		runtime,
		url: typeof value.url === "string" ? value.url.trim() : "",
		version,
	};
}

export const EMPTY_STORE: McpStore = { items: [] };

export function parseStore(raw: unknown): McpStore {
	if (typeof raw !== "string") return EMPTY_STORE;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || !Array.isArray(parsed.items)) return EMPTY_STORE;
		const seenIds = new Set<string>();
		const seenNames = new Set<string>();
		const items: InstalledMcpEntry[] = [];
		for (const v of parsed.items) {
			const entry = asEntry(v);
			if (!entry || seenIds.has(entry.id)) continue;
			const lowered = entry.name.toLowerCase();
			if (seenNames.has(lowered)) continue;
			seenIds.add(entry.id);
			seenNames.add(lowered);
			items.push(entry);
		}
		return { items };
	} catch {
		return EMPTY_STORE;
	}
}

export function loadStore(): McpStore {
	try {
		if (typeof window === "undefined" || !window.localStorage) {
			return EMPTY_STORE;
		}
		return parseStore(window.localStorage.getItem(STORAGE_KEY));
	} catch {
		return EMPTY_STORE;
	}
}

export function saveStore(store: McpStore): void {
	try {
		if (typeof window === "undefined" || !window.localStorage) return;
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Storage full or unavailable — the page keeps working in memory.
	}
}
