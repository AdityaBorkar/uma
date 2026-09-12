import { existsSync } from "node:fs";
import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";

import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from "../schemas/db/index.ts";
import { chmod0600, ensureParentDir } from "./fs-utils.ts";

export type DrizzleDb = ReturnType<typeof createDrizzle>;
export type Db = DrizzleDb;
/** Writable handle: drizzle db or a drizzle transaction (for persistReceipts). */
export type DbTx =
	| DrizzleDb
	| Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

function createDrizzle(raw: Database) {
	return drizzle({ client: raw });
}

const SQLITE_SIDECARS = ["-wal", "-shm", "-journal"];

function chmodDb0600(path: string): void {
	chmod0600(
		path,
		SQLITE_SIDECARS.filter((s) => existsSync(path + s)),
	);
}

function applyPragmas(raw: Database): void {
	raw.exec("PRAGMA journal_mode = WAL;");
	raw.exec("PRAGMA synchronous = NORMAL;");
	try {
		raw.exec("PRAGMA busy_timeout = 5000;");
	} catch {
		// older SQLite builds may reject; single-writer still works
	}
}

/**
 * Converge state.db to the schema (`src/schemas/db/index.ts`) on open.
 *
 * No migration files: `SCHEMA_STATEMENTS` is applied additively on every
 * writable open — `CREATE TABLE/INDEX IF NOT EXISTS` plus `ADD COLUMN` for
 * post-v1 columns, where only "duplicate column name" failures are tolerated.
 * Nothing is destructive and every statement is idempotent, so a crash on any
 * open simply replays the sync. `PRAGMA user_version` carries SCHEMA_VERSION
 * for ops introspection.
 */
function applyMigrations(raw: Database): void {
	for (const stmt of SCHEMA_STATEMENTS) {
		try {
			raw.exec(stmt);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!msg.includes("duplicate column name")) throw e;
		}
	}
	raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/** Current schema version (what `PRAGMA user_version` gets stamped with). */
export function latestSchemaVersion(): number {
	return SCHEMA_VERSION;
}

/**
 * Open state.db and return a drizzle handle augmented with lifecycle helpers.
 *
 * - `db.$client` is the underlying `bun:sqlite` Database (escape hatch for
 *   `VACUUM`, which cannot run inside a drizzle transaction).
 * - `db.close()` closes the underlying handle (mirrors the old `openDb` API
 *   so existing `const db = openDb(p); ...; db.close()` call sites keep working).
 */
export function openDb(
	dbPath: string,
	readonly = false,
): DrizzleDb & {
	close: () => void;
} {
	ensureParentDir(dbPath);
	const raw = new Database(dbPath, { create: !readonly, readonly });
	applyPragmas(raw);
	const db = createDrizzle(raw) as DrizzleDb & {
		$client: Database;
		close: () => void;
	};
	if (!readonly) {
		applyMigrations(raw);
		chmodDb0600(dbPath);
	}
	db.close = () => {
		try {
			raw.close();
		} catch {
			// ignore close errors
		}
	};
	return db;
}

/** Apply pending schema sync to an existing path (enroll/ops path). */
export function migrate(dbPath: string): void {
	const db = openDb(dbPath, false);
	try {
		chmodDb0600(dbPath);
	} finally {
		db.close();
	}
}

/** Open a DB, run fn, always close. Replaces hand-rolled open/try/close. */
export function withDb<T>(
	dbPath: string,
	readonly: boolean,
	fn: (db: DrizzleDb) => T,
): T {
	const db = openDb(dbPath, readonly);
	try {
		return fn(db);
	} finally {
		try {
			db.close();
		} catch {
			// ignore close errors
		}
	}
}
