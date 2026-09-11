import { existsSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate as drizzleMigrate } from "drizzle-orm/bun-sqlite/migrator";

import { chmod0600, ensureParentDir } from "../fs-utils.ts";

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

function migrationsFolder(): string {
	// drizzle/ at repo root when running from source; dist/ keeps a copy for
	// the compiled binary (see package.json scripts.db:copy-migrations).
	const candidates = [
		join(import.meta.dir, "..", "..", "drizzle"),
		join(process.cwd(), "drizzle"),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return candidates[0] as string;
}

function applyMigrations(db: DrizzleDb): void {
	const folder = migrationsFolder();
	if (!existsSync(folder)) return;
	try {
		drizzleMigrate(db, { migrationsFolder: folder });
	} catch (e) {
		// A pre-drizzle state.db already has the tables (created by the
		// legacy CREATE TABLE IF NOT EXISTS path). The baseline migration is
		// written with IF NOT EXISTS so re-running is safe; any other error
		// (e.g. readonly) propagates to the caller.
		const msg = e instanceof Error ? e.message : String(e);
		if (!/already exists/i.test(msg)) throw e;
	}
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
		applyMigrations(db);
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

/** Run drizzle-kit migrations against an existing path (enroll path). */
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
