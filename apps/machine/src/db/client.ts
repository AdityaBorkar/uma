import { existsSync } from "node:fs";
import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";

import { chmod0600, ensureParentDir } from "../fs-utils.ts";
import { LATEST_VERSION, MIGRATIONS } from "./migrations.ts";

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

function currentUserVersion(raw: Database): number {
	try {
		const row = raw.query("PRAGMA user_version;").get() as {
			user_version: number;
		} | null;
		return Number(row?.user_version ?? 0);
	} catch {
		return 0;
	}
}

/**
 * Apply pending embedded migrations to the XDG state.db.
 *
 * The machine has no repo checkout (compiled single binary), so migrations
 * are bundled in `src/db/migrations.ts` and tracked with
 * `PRAGMA user_version` stored inside the database file itself — no external
 * migration folder needed. Each migration applies atomically; the version
 * only advances on success, so a crash replays the same migration.
 */
function applyMigrations(raw: Database): void {
	const current = currentUserVersion(raw);
	for (const m of MIGRATIONS) {
		if (m.version <= current) continue;
		raw.exec("BEGIN;");
		try {
			raw.exec(m.sql);
			raw.exec(`PRAGMA user_version = ${m.version};`);
			raw.exec("COMMIT;");
		} catch (e) {
			try {
				raw.exec("ROLLBACK;");
			} catch {
				// rollback best-effort; original error is what matters
			}
			throw e;
		}
	}
}

/** Highest embedded migration version (for tests/ops introspection). */
export function latestMigrationVersion(): number {
	return LATEST_VERSION;
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

/** Apply pending embedded migrations to an existing path (enroll/ops path). */
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
