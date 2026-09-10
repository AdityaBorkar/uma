import { join } from "node:path";

// biome-ignore lint/correctness/noUnresolvedImports: types resolve via @types/env-paths (tsc clean); biome resolver misses the exports map.
import envPaths from "env-paths";
import ms from "ms";
import { z } from "zod";

function first(...vals: (string | undefined)[]): string | undefined {
	for (const v of vals) {
		if (v !== undefined && v !== "") return v;
	}
	return undefined;
}

// OS-correct config/data roots (XDG on Linux, ~/Library on macOS, AppData on
// Windows). `suffix: ""` keeps the historic `uma-machine` leaf (no `-nodejs`
// suffix). Called per-access (not at module load) so UMA_*/XDG_* test
// overrides apply. UMA_* env vars always win (no env var removed).
function osConfigDir(): string {
	return envPaths("uma-machine", { suffix: "" }).config;
}

function osDataDir(): string {
	return envPaths("uma-machine", { suffix: "" }).data;
}

export function configDir(): string {
	// UMA_CONFIG_HOME is the full dir; UMA_MACHINE_ROOT is the root.
	// Otherwise the OS-correct root (on Linux: XDG_CONFIG_HOME base with
	// the uma-machine leaf joined, else ~/.config/uma-machine).
	const direct = first(process.env.UMA_CONFIG_HOME);
	if (direct) return direct;
	if (process.env.UMA_MACHINE_ROOT) return process.env.UMA_MACHINE_ROOT;
	return osConfigDir();
}

export function dataDir(): string {
	// UMA_DATA_HOME is the full dir (mirrors UMA_CONFIG_HOME semantics).
	// Otherwise the OS-correct root (on Linux: XDG_DATA_HOME base with
	// the uma-machine leaf joined, else ~/.local/share/uma-machine).
	const direct = first(process.env.UMA_DATA_HOME);
	if (direct) return direct;
	if (process.env.UMA_MACHINE_ROOT)
		return join(process.env.UMA_MACHINE_ROOT, "data");
	return osDataDir();
}

export function identityPath(): string {
	const f = process.env.UMA_TOKEN_FILE;
	if (f) return f;
	return join(configDir(), "identity.json");
}

export function limitsPath(): string {
	return join(configDir(), "limits.json");
}

export function stateDbPath(): string {
	const s = process.env.UMA_STATE_DB;
	if (s) return s;
	return join(dataDir(), "state.db");
}

export function serverUrl(): string {
	return (
		first(process.env.UMA_SERVER_URL, process.env.UMA_SERVER) ??
		"http://127.0.0.1:3000"
	);
}

export function heartbeatIntervalS(): number {
	return z.coerce
		.number()
		.int()
		.min(5)
		.catch(30)
		.parse(process.env.UMA_HEARTBEAT_INTERVAL_S);
}

export function heartbeatRetentionDays(): number {
	return z.coerce
		.number()
		.int()
		.min(1)
		.catch(30)
		.parse(process.env.UMA_HEARTBEAT_RETENTION_DAYS);
}

function msbConfigured(): string | undefined {
	return first(process.env.UMA_MSB_BIN, process.env.MSB_PATH);
}

export function msbBin(): string {
	return msbConfigured() ?? "msb";
}

export function msbPath(): string | undefined {
	return msbConfigured();
}

/** Shared interval coercion: finite integer >= floor wins, else fallback(). */
export function coerceIntervalS(
	raw: unknown,
	floor: number,
	fallback: number,
): number {
	if (typeof raw !== "string" && typeof raw !== "number") return fallback;
	return z.coerce.number().int().min(floor).catch(fallback).parse(raw);
}

/** Daemon tick interval: explicit >=2s wins, else heartbeatIntervalS(). */
export function daemonIntervalS(raw?: unknown): number {
	if (raw === undefined) return heartbeatIntervalS();
	return coerceIntervalS(raw, 2, heartbeatIntervalS());
}

/** CLI --prune flag: explicit false/"false" => false, else Boolean(v). */
export function parsePruneFlag(v: unknown): boolean {
	if (v === false || v === "false") return false;
	return Boolean(v);
}

/** Split a comma-joined key list (`--only k1,k2`) into trimmed non-empty keys. */
export function parseKeyList(v: string): string[] {
	return v
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Parse --only <k1,k2> (also accepts repeated/comma-joined forms). */
export function parseOnlyFlag(v: unknown): string[] | undefined {
	if (v === undefined || v === null || v === false) return undefined;
	const s = String(v);
	if (s.trim() === "") return undefined;
	return parseKeyList(s);
}

export function sandboxTtlMs(): number {
	return (
		z.coerce
			.number()
			.int()
			.min(60)
			.catch(3600)
			.parse(process.env.UMA_SANDBOX_TTL_S) * ms("1s")
	);
}
