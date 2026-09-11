/**
 * Embedded SQLite migrations for the device-side state.db.
 *
 * The machine runs as a compiled single binary (`bun build --compile`) with
 * its database at the XDG data path (`stateDbPath()` — e.g.
 * `~/.local/share/uma-machine/state.db`). There is no repo checkout on the
 * machine, so runtime migrations cannot depend on drizzle-kit's `./drizzle`
 * folder. This module is the single source of truth for runtime DDL: it is
 * bundled into the binary and applied directly to the XDG state.db,
 * versioned with `PRAGMA user_version`.
 *
 * Dev workflow: `src/db/schema.ts` stays the drizzle schema source of truth
 * for `drizzle-kit generate` (diffing only). When the schema changes, add a
 * new entry below AND regenerate `./drizzle` for review history.
 */

export interface EmbeddedMigration {
	name: string;
	sql: string;
	/** Monotonic version, stored in `PRAGMA user_version` after apply. */
	version: number;
}

/**
 * Baseline schema (v1). Mirrors `src/db/schema.ts` exactly:
 * - heartbeats(ts PK, cpu/ram/disk REAL, pids/sandboxes/config_version/quota_usage TEXT)
 * - sandbox_events(ts, sandbox_id, event, task_id?, detail?) + idx on (ts), (sandbox_id, ts)
 * - config_receipts(ts, job_id, key, ok INTEGER 0/1, error?) + idx on (ts)
 * - provider_keys(provider PK, fingerprint, secret, updated_at)
 * - log_buffer(ts, task_id, chunk) + idx on (task_id, ts), (ts)
 *
 * `IF NOT EXISTS` keeps the upgrade idempotent for pre-migration databases
 * created by the legacy `CREATE TABLE IF NOT EXISTS` path (user_version = 0
 * with tables already present).
 */
const V1_BASELINE = `
CREATE TABLE IF NOT EXISTS \`config_receipts\` (
	\`error\` text,
	\`job_id\` text NOT NULL,
	\`key\` text NOT NULL,
	\`ok\` integer NOT NULL,
	\`ts\` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS \`heartbeats\` (
	\`config_version\` text DEFAULT 'v1' NOT NULL,
	\`cpu\` real NOT NULL,
	\`disk\` real NOT NULL,
	\`pids\` text DEFAULT '[]' NOT NULL,
	\`quota_usage\` text DEFAULT '{}' NOT NULL,
	\`ram\` real NOT NULL,
	\`sandboxes\` text DEFAULT '[]' NOT NULL,
	\`ts\` integer PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS \`log_buffer\` (
	\`chunk\` text NOT NULL,
	\`task_id\` text NOT NULL,
	\`ts\` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS \`provider_keys\` (
	\`fingerprint\` text NOT NULL,
	\`provider\` text PRIMARY KEY,
	\`secret\` text NOT NULL,
	\`updated_at\` integer NOT NULL
);
CREATE TABLE IF NOT EXISTS \`sandbox_events\` (
	\`detail\` text,
	\`event\` text NOT NULL,
	\`sandbox_id\` text NOT NULL,
	\`task_id\` text,
	\`ts\` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS \`idx_config_receipts_ts\` ON \`config_receipts\` (\`ts\`);
CREATE INDEX IF NOT EXISTS \`idx_log_buffer_task\` ON \`log_buffer\` (\`task_id\`,\`ts\`);
CREATE INDEX IF NOT EXISTS \`idx_log_buffer_ts\` ON \`log_buffer\` (\`ts\`);
CREATE INDEX IF NOT EXISTS \`idx_sandbox_events_ts\` ON \`sandbox_events\` (\`ts\`);
CREATE INDEX IF NOT EXISTS \`idx_sandbox_events_sandbox\` ON \`sandbox_events\` (\`sandbox_id\`,\`ts\`);
`;

export const MIGRATIONS: EmbeddedMigration[] = [
	{ name: "0001_baseline", sql: V1_BASELINE, version: 1 },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
