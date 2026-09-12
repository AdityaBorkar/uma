import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const heartbeats = sqliteTable("heartbeats", {
	configVersion: text("config_version").notNull().default("v1"),
	cpu: real("cpu").notNull(),
	disk: real("disk").notNull(),
	pids: text("pids").notNull().default("[]"),
	quotaUsage: text("quota_usage").notNull().default("{}"),
	ram: real("ram").notNull(),
	sandboxes: text("sandboxes").notNull().default("[]"),
	ts: integer("ts").primaryKey(),
});

export const sandboxEvents = sqliteTable(
	"sandbox_events",
	{
		detail: text("detail"),
		event: text("event").notNull(),
		sandboxId: text("sandbox_id").notNull(),
		taskId: text("task_id"),
		ts: integer("ts").notNull(),
	},
	(t) => [
		index("idx_sandbox_events_ts").on(t.ts),
		index("idx_sandbox_events_sandbox").on(t.sandboxId, t.ts),
	],
);

export const configReceipts = sqliteTable(
	"config_receipts",
	{
		error: text("error"),
		jobId: text("job_id").notNull(),
		key: text("key").notNull(),
		ok: integer("ok").notNull(),
		ts: integer("ts").notNull(),
	},
	(t) => [index("idx_config_receipts_ts").on(t.ts)],
);

export const providerKeys = sqliteTable("provider_keys", {
	fingerprint: text("fingerprint").notNull(),
	provider: text("provider").primaryKey(),
	secret: text("secret").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const logBuffer = sqliteTable(
	"log_buffer",
	{
		chunk: text("chunk").notNull(),
		taskId: text("task_id").notNull(),
		ts: integer("ts").notNull(),
	},
	(t) => [
		index("idx_log_buffer_task").on(t.taskId, t.ts),
		index("idx_log_buffer_ts").on(t.ts),
	],
);

/**
 * Schema version stamped into `PRAGMA user_version` after the DDL below is
 * applied. Bump when the DDL changes (introspection only — convergence is
 * idempotent and never reads the version).
 */
export const SCHEMA_VERSION = 2;

/**
 * Additive DDL for state.db, mirroring the drizzle tables above 1:1 (keep the
 * two in sync). Applied on every writable open (`utils/client.ts`):
 *
 * - `CREATE TABLE/INDEX IF NOT EXISTS` converge fresh or partial databases.
 * - The `ALTER TABLE ... ADD COLUMN` lines cover columns added after v1 and
 *   are the only statements expected to fail ("duplicate column name") on an
 *   already-converged database — `applyMigrations` tolerates exactly that
 *   error and nothing else.
 *
 * Nothing destructive is ever emitted (no DROP / RENAME / type change);
 * SQLite would require a table rebuild for those, which is a manual ops step.
 */
export const SCHEMA_STATEMENTS: string[] = [
	`CREATE TABLE IF NOT EXISTS heartbeats (
	ts INTEGER PRIMARY KEY,
	config_version TEXT NOT NULL DEFAULT 'v1',
	cpu REAL NOT NULL,
	disk REAL NOT NULL,
	pids TEXT NOT NULL DEFAULT '[]',
	quota_usage TEXT NOT NULL DEFAULT '{}',
	ram REAL NOT NULL,
	sandboxes TEXT NOT NULL DEFAULT '[]'
)`,
	`CREATE TABLE IF NOT EXISTS sandbox_events (
	ts INTEGER NOT NULL,
	sandbox_id TEXT NOT NULL,
	event TEXT NOT NULL,
	task_id TEXT,
	detail TEXT
)`,
	`CREATE INDEX IF NOT EXISTS idx_sandbox_events_ts ON sandbox_events (ts)`,
	`CREATE INDEX IF NOT EXISTS idx_sandbox_events_sandbox ON sandbox_events (sandbox_id, ts)`,
	`CREATE TABLE IF NOT EXISTS config_receipts (
	job_id TEXT NOT NULL,
	key TEXT NOT NULL,
	ok INTEGER NOT NULL,
	ts INTEGER NOT NULL,
	error TEXT
)`,
	`CREATE INDEX IF NOT EXISTS idx_config_receipts_ts ON config_receipts (ts)`,
	`CREATE TABLE IF NOT EXISTS provider_keys (
	provider TEXT PRIMARY KEY,
	fingerprint TEXT NOT NULL,
	secret TEXT NOT NULL,
	updated_at INTEGER NOT NULL
)`,
	`CREATE TABLE IF NOT EXISTS log_buffer (
	chunk TEXT NOT NULL,
	task_id TEXT NOT NULL,
	ts INTEGER NOT NULL
)`,
	`CREATE INDEX IF NOT EXISTS idx_log_buffer_task ON log_buffer (task_id, ts)`,
	`CREATE INDEX IF NOT EXISTS idx_log_buffer_ts ON log_buffer (ts)`,
	// Post-v1 additive columns (tolerated "duplicate column name" when present).
	`ALTER TABLE heartbeats ADD COLUMN quota_usage TEXT NOT NULL DEFAULT '{}'`,
];
