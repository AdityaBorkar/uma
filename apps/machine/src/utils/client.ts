import { existsSync } from "node:fs";
import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";

import { chmod0600, ensureParentDir } from "../fs-utils.ts";
import {
	currentSchemaVersion,
	stampSchemaVersion,
	syncSchema,
} from "./schema-sync.ts";

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
 * Converge state.db to the drizzle schema (`src/db/schema.ts`) on open.
 *
 * No migration files exist: the DDL is computed on the go from the schema and
 * applied additively (CREATE TABLE IF NOT EXISTS / ADD COLUMN / CREATE INDEX
 * IF NOT EXISTS) by `syncSchema` — see `db/schema-sync.ts`. Nothing is
 * destructive, each open runs in one transaction, and a crash replays the
 * sync. `PRAGMA user_version` mirrors the schema fingerprint for ops
 * introspection.
 */
function applyMigrations(raw: Database): void {
	syncSchema(raw);
	stampSchemaVersion(raw);
}

/** Schema fingerprint stamped into `PRAGMA user_version` after apply. */
export function latestSchemaVersion(): number {
	return currentSchemaVersion();
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
