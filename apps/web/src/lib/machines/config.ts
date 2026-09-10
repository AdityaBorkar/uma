import { env } from "#/env.ts";

/**
 * Machine server tunables. Wire-frozen values come from `@uma/orpc-contract`
 * (`constants.ts`); deployment-specific values come from env with the same
 * defaults the `server-central` test harness used.
 */

export const MIN_CLI_VERSION = "0.1.0";

/** Pre-bound OAuth client allowlist (mirrors `validateClient` server-side). */
export function allowedClients(): string[] {
	return (env.MACHINE_CLIENT_ALLOWLIST ?? "uma-machine,roundtrip")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Dev-only seed helpers (`src/routes/api.test.*`) are enabled when true. */
export function e2eSeedEnabled(): boolean {
	return env.E2E_SEED;
}

export const DEVICE_CODE_TTL_S = 600;
export const DEVICE_POLL_INTERVAL_S = 2;

/** Heartbeat rows older than this are pruned best-effort on write. */
export const HEARTBEAT_RETENTION_DAYS = 30;

/** Cap stored log chunks per row (matches the 256KB wire cap). */
export const LOG_CHUNK_CAP_BYTES = 256 * 1024;

/** Cap heartbeat rows read back per machine for history. */
export const HEARTBEAT_HISTORY_LIMIT = 5000;
