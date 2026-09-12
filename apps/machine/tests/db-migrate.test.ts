import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { LATEST_VERSION, MIGRATIONS_JOURNAL } from "../src/db/migrations.ts";
import {
	countHeartbeats,
	insertHeartbeat,
	latestMigrationVersion,
	migrate,
	openDb,
} from "../src/db.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-db-migrate-"));
	dbPath = join(dir, "state.db");
});

afterEach(() => {
	rmSync(dir, { force: true, recursive: true });
});

function userVersion(path: string): number {
	const raw = new Database(path, { readonly: true });
	try {
		const row = raw.query("PRAGMA user_version;").get() as {
			user_version: number;
		} | null;
		return Number(row?.user_version ?? 0);
	} finally {
		raw.close();
	}
}

function tableNames(path: string): string[] {
	const raw = new Database(path, { readonly: true });
	try {
		const rows = raw
			.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
			.all() as { name: string }[];
		return rows.map((r) => r.name);
	} finally {
		raw.close();
	}
}

describe("db migrations (embedded, XDG state.db)", () => {
	test("fresh openDb creates schema + stamps user_version", () => {
		const db = openDb(dbPath);
		db.close();
		expect(userVersion(dbPath)).toBe(LATEST_VERSION);
		expect(userVersion(dbPath)).toBe(latestMigrationVersion());
		const tables = tableNames(dbPath);
		for (const t of [
			"config_receipts",
			"heartbeats",
			"log_buffer",
			"provider_keys",
			"sandbox_events",
		]) {
			expect(tables).toContain(t);
		}
	});

	test("reopen is idempotent and preserves data", () => {
		const db = openDb(dbPath);
		insertHeartbeat(db, {
			configVersion: "v1",
			cpu: 1,
			disk: 1,
			pids: [],
			quotaUsage: {},
			ram: 1,
			sandboxes: [],
			ts: 7,
		});
		db.close();
		const v1 = userVersion(dbPath);
		const db2 = openDb(dbPath);
		expect(countHeartbeats(db2)).toBe(1);
		db2.close();
		expect(userVersion(dbPath)).toBe(v1);
	});

	test("legacy pre-migration db (tables, version 0) upgrades without data loss", () => {
		// Simulate a pre-drizzle state.db: tables exist, user_version untouched.
		const raw = new Database(dbPath, { create: true });
		raw.exec(`
      CREATE TABLE heartbeats(ts INTEGER PRIMARY KEY, cpu REAL NOT NULL, ram REAL NOT NULL, disk REAL NOT NULL, pids TEXT NOT NULL DEFAULT '[]', sandboxes TEXT NOT NULL DEFAULT '[]', config_version TEXT NOT NULL DEFAULT 'v1', quota_usage TEXT NOT NULL DEFAULT '{}');
      INSERT INTO heartbeats(ts, cpu, ram, disk) VALUES (42, 1, 2, 3);
    `);
		raw.exec("PRAGMA user_version = 0;");
		raw.close();
		expect(userVersion(dbPath)).toBe(0);

		const db = openDb(dbPath);
		expect(countHeartbeats(db)).toBe(1);
		db.close();
		expect(userVersion(dbPath)).toBe(LATEST_VERSION);
		const tables = tableNames(dbPath);
		for (const t of [
			"config_receipts",
			"heartbeats",
			"log_buffer",
			"provider_keys",
			"sandbox_events",
		]) {
			expect(tables).toContain(t);
		}
	});

	test("migrate() targets any XDG-style path", () => {
		const nested = join(dir, "sub", "state.db");
		migrate(nested);
		expect(userVersion(nested)).toBe(LATEST_VERSION);
		// Second run is a no-op success.
		migrate(nested);
		expect(userVersion(nested)).toBe(LATEST_VERSION);
	});

	test("drizzle journal tracks applied migrations", () => {
		const db = openDb(dbPath);
		db.close();
		const raw = new Database(dbPath, { readonly: true });
		try {
			const rows = raw
				.query("SELECT name FROM __drizzle_migrations ORDER BY name;")
				.all() as { name: string }[];
			expect(rows.length).toBe(LATEST_VERSION);
			expect(rows.map((r) => r.name)).toEqual(
				MIGRATIONS_JOURNAL.map((m) => m.name),
			);
		} finally {
			raw.close();
		}
	});

	test("embedded journal matches drizzle-kit output (run bun run db:codegen)", () => {
		const drizzleDir = join(import.meta.dir, "..", "drizzle");
		const folders = readdirSync(drizzleDir, { withFileTypes: true })
			.filter(
				(e) =>
					e.isDirectory() &&
					existsSync(join(drizzleDir, e.name, "migration.sql")),
			)
			.map((e) => e.name)
			.sort();
		expect(MIGRATIONS_JOURNAL.map((m) => m.name)).toEqual(folders);
		expect(LATEST_VERSION).toBe(folders.length);
	});
});
