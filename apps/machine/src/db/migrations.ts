/**
 * GENERATED — do not hand-edit. Run `bun run db:codegen` to regenerate.
 *
 * Embedded SQLite migrations for the device-side state.db, derived
 * automatically from drizzle-kit's `./drizzle/<timestamp>_<name>/migration.sql`
 * (source of truth: `src/db/schema.ts` via `drizzle-kit generate`).
 *
 * The machine runs as a compiled single binary (`bun build --compile`) with
 * its database at the XDG data path (`stateDbPath()`). There is no repo
 * checkout on the machine, so runtime uses drizzle-orm's embedded-journal
 * mode (`migrate(db, { migrationsJournal })`) — no `./drizzle` folder is
 * read at runtime. Applied migrations are tracked in the
 * `__drizzle_migrations` table inside state.db itself.
 *
 * `CREATE TABLE/INDEX` statements carry `IF NOT EXISTS` (added mechanically
 * by `scripts/generate-embedded-migrations.ts`) so pre-drizzle databases
 * upgrade in place without data loss.
 *
 * Dev workflow: edit `src/db/schema.ts`, then `bun run db:generate`
 * (= `drizzle-kit generate` + embed). Never edit this file by hand.
 */

export interface EmbeddedJournalEntry {
	name: string;
	sql: string;
	timestamp: number;
}

export const MIGRATIONS_JOURNAL: EmbeddedJournalEntry[] = [
	{
		name: "20260912051916_baseline",
		sql: `CREATE TABLE IF NOT EXISTS \`config_receipts\` (
	\`error\` text,
	\`job_id\` text NOT NULL,
	\`key\` text NOT NULL,
	\`ok\` integer NOT NULL,
	\`ts\` integer NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`log_buffer\` (
	\`chunk\` text NOT NULL,
	\`task_id\` text NOT NULL,
	\`ts\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`provider_keys\` (
	\`fingerprint\` text NOT NULL,
	\`provider\` text PRIMARY KEY,
	\`secret\` text NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`sandbox_events\` (
	\`detail\` text,
	\`event\` text NOT NULL,
	\`sandbox_id\` text NOT NULL,
	\`task_id\` text,
	\`ts\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_config_receipts_ts\` ON \`config_receipts\` (\`ts\`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_log_buffer_task\` ON \`log_buffer\` (\`task_id\`,\`ts\`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_log_buffer_ts\` ON \`log_buffer\` (\`ts\`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_sandbox_events_ts\` ON \`sandbox_events\` (\`ts\`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`idx_sandbox_events_sandbox\` ON \`sandbox_events\` (\`sandbox_id\`,\`ts\`);
`,
		timestamp: 1789190356000,
	},
];

/** Number of embedded migrations (mirrored into `PRAGMA user_version` after apply). */
export const LATEST_VERSION = MIGRATIONS_JOURNAL.length;
