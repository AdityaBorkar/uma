import {
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for the device-side SQLite state.db.
 *
 * Single source of truth for the database layout: no migration files exist —
 * `src/db/schema-sync.ts` computes the DDL from these table definitions at
 * runtime and converges each state.db additively on open.
 *
 * Tables:
 * - heartbeats(ts PK, cpu/ram/disk REAL, pids/sandboxes/config_version/quota_usage TEXT)
 * - sandbox_events(ts, sandbox_id, event, task_id?, detail?) + idx on ts
 * - config_receipts(ts, job_id, key, ok INTEGER 0/1, error?) + idx on ts
 * - provider_keys(provider PK, fingerprint, secret, updated_at)
 * - log_buffer(ts, task_id, chunk) + idx on (task_id, ts)
 *
 * `ok` stays a plain INTEGER (0/1) rather than boolean mode to preserve the
 * existing `ReceiptRow.ok: number` wire shape.
 */
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
		// Reap joins by (sandbox_id, ts); the ts-only index can't serve it.
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
		// Global 7d prune filters on ts alone; (task_id, ts) can't serve it.
		index("idx_log_buffer_ts").on(t.ts),
	],
);

export const schema = {
	configReceipts,
	heartbeats,
	logBuffer,
	providerKeys,
	sandboxEvents,
};
