import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	countHeartbeats,
	insertHeartbeat,
	latestSchemaVersion,
	migrate,
	openDb,
} from "../src/utils/db.ts";

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

describe("db schema sync (SCHEMA_STATEMENTS, XDG state.db)", () => {
	test("fresh openDb creates schema + stamps schema fingerprint", () => {
		const db = openDb(dbPath);
		db.close();
		expect(userVersion(dbPath)).toBe(latestSchemaVersion());
		expect(userVersion(dbPath)).toBe(latestSchemaVersion());
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

	test("legacy pre-sync db (tables, version 0) upgrades without data loss", () => {
		// Simulate a legacy state.db: tables exist, user_version untouched.
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
		expect(userVersion(dbPath)).toBe(latestSchemaVersion());
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

	test("missing columns are added additively without data loss", () => {
		// Older schema: heartbeats without quota_usage.
		const raw = new Database(dbPath, { create: true });
		raw.exec(`
      CREATE TABLE heartbeats(ts INTEGER PRIMARY KEY, cpu REAL NOT NULL, ram REAL NOT NULL, disk REAL NOT NULL, pids TEXT NOT NULL DEFAULT '[]', sandboxes TEXT NOT NULL DEFAULT '[]', config_version TEXT NOT NULL DEFAULT 'v1');
      INSERT INTO heartbeats(ts, cpu, ram, disk, pids, sandboxes, config_version) VALUES (42, 1, 2, 3, '[]', '[]', 'v1');
    `);
		raw.close();

		const db = openDb(dbPath);
		expect(countHeartbeats(db)).toBe(1);
		const col = new Database(dbPath, { readonly: true })
			.query("PRAGMA table_info(heartbeats);")
			.all() as { name: string }[];
		expect(col.map((c) => c.name)).toContain("quota_usage");
		db.close();
	});

	test("migrate() targets any XDG-style path", () => {
		const nested = join(dir, "sub", "state.db");
		migrate(nested);
		expect(userVersion(nested)).toBe(latestSchemaVersion());
		// Second run is a no-op success.
		migrate(nested);
		expect(userVersion(nested)).toBe(latestSchemaVersion());
	});
});
