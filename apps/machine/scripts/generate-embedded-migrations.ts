#!/usr/bin/env bun
// Embed drizzle-kit SQL migrations into `src/db/migrations.ts` (dev-only).
// Usage: bun run db:codegen   (or: bun run db:generate = drizzle-kit generate + this)
// Reads `drizzle/<timestamp>_<name>/migration.sql` (sorted by folder name,
// mirroring drizzle-orm's `readMigrationFiles`) and emits a GENERATED
// `src/db/migrations.ts` exporting `MIGRATIONS_JOURNAL` for
// `drizzle-orm/bun-sqlite/migrator`'s embedded-journal mode. The compiled
// single binary has no repo checkout, so runtime never reads `./drizzle`
// from disk — the SQL travels inside the bundle.
//
// Idempotency note: `CREATE TABLE/INDEX` statements are emitted with
// `IF NOT EXISTS` so pre-drizzle `state.db` files (tables present,
// no `__drizzle_migrations` rows) upgrade in place without data loss.
// This is a mechanical transform of drizzle-kit output, not hand-written
// SQL — rerunning this script overwrites any manual edits.
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const appDir = join(here, "..");
const drizzleDir = join(appDir, "drizzle");
const outPath = join(appDir, "src", "db", "migrations.ts");

/** Same derivation as drizzle-orm's `formatToMillis` (folder prefix YYYYMMDDHHmmss → UTC millis). */
function folderPrefixToMillis(prefix: string): number {
	const year = Number(prefix.slice(0, 4));
	const month = Number(prefix.slice(4, 6)) - 1;
	const day = Number(prefix.slice(6, 8));
	const hour = Number(prefix.slice(8, 10));
	const minute = Number(prefix.slice(10, 12));
	const second = Number(prefix.slice(12, 14));
	return Date.UTC(year, month, day, hour, minute, second);
}

/** Mechanical idempotency guard for pre-drizzle databases (see header). */
function toIdempotentSql(sql: string): string {
	return sql
		.replaceAll("CREATE TABLE `", "CREATE TABLE IF NOT EXISTS `")
		.replaceAll("CREATE INDEX `", "CREATE INDEX IF NOT EXISTS `");
}

/** Escape raw SQL for embedding in a template literal. */
function toTemplateLiteral(sql: string): string {
	return sql
		.replaceAll("\\", "\\\\")
		.replaceAll("`", "\\`")
		.replaceAll("${", "\\${");
}

const folders = existsSync(drizzleDir)
	? readdirSync(drizzleDir, { withFileTypes: true })
			.filter(
				(e) =>
					e.isDirectory() &&
					existsSync(join(drizzleDir, e.name, "migration.sql")),
			)
			.map((e) => e.name)
			.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
	: [];

if (folders.length === 0) {
	console.error(
		"generate-embedded-migrations: no migrations found in ./drizzle — run `drizzle-kit generate` first.",
	);
	process.exit(1);
}

const entries = folders.map((name) => {
	const raw = readFileSync(join(drizzleDir, name, "migration.sql"), "utf8");
	const sql = `${toIdempotentSql(raw).trimEnd()}\n`;
	return { name, sql, timestamp: folderPrefixToMillis(name.slice(0, 14)) };
});

const body = entries
	.map(
		(e) =>
			`\t{\n\t\tname: ${JSON.stringify(e.name)},\n\t\tsql: \`${toTemplateLiteral(e.sql)}\`,\n\t\ttimestamp: ${e.timestamp},\n\t},`,
	)
	.join("\n");

const out = `/**
 * GENERATED — do not hand-edit. Run \`bun run db:codegen\` to regenerate.
 *
 * Embedded SQLite migrations for the device-side state.db, derived
 * automatically from drizzle-kit's \`./drizzle/<timestamp>_<name>/migration.sql\`
 * (source of truth: \`src/db/schema.ts\` via \`drizzle-kit generate\`).
 *
 * The machine runs as a compiled single binary (\`bun build --compile\`) with
 * its database at the XDG data path (\`stateDbPath()\`). There is no repo
 * checkout on the machine, so runtime uses drizzle-orm's embedded-journal
 * mode (\`migrate(db, { migrationsJournal })\`) — no \`./drizzle\` folder is
 * read at runtime. Applied migrations are tracked in the
 * \`__drizzle_migrations\` table inside state.db itself.
 *
 * \`CREATE TABLE/INDEX\` statements carry \`IF NOT EXISTS\` (added mechanically
 * by \`scripts/generate-embedded-migrations.ts\`) so pre-drizzle databases
 * upgrade in place without data loss.
 *
 * Dev workflow: edit \`src/db/schema.ts\`, then \`bun run db:generate\`
 * (= \`drizzle-kit generate\` + embed). Never edit this file by hand.
 */

export interface EmbeddedJournalEntry {
	name: string;
	sql: string;
	timestamp: number;
}

export const MIGRATIONS_JOURNAL: EmbeddedJournalEntry[] = [
${body}
];

/** Number of embedded migrations (mirrored into \`PRAGMA user_version\` after apply). */
export const LATEST_VERSION = MIGRATIONS_JOURNAL.length;
`;

mkdirSync(join(appDir, "src", "db"), { recursive: true });
writeFileSync(outPath, out);
console.log(`embedded ${entries.length} migration(s) → src/db/migrations.ts`);
for (const e of entries) console.log(`  - ${e.name}`);
