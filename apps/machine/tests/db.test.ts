import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	bufferLog,
	countHeartbeats,
	deleteLogBufferThrough,
	drainLogBuffer,
	getProviderKeys,
	insertHeartbeat,
	insertReceipt,
	insertSandboxEvent,
	lastSandboxEventTsBatch,
	latestReceipts,
	openDb,
	peekLogBuffer,
	queryHistory,
	setProviderKey,
	vacuumRetention,
} from "../src/db.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-db-"));
	dbPath = join(dir, "state.db");
});

afterEach(() => {
	rmSync(dir, { force: true, recursive: true });
});

describe("db (drizzle-orm/bun-sqlite, 30d raw, no rollup)", () => {
	test("migrate + heartbeat insert/query", () => {
		const db = openDb(dbPath);
		insertHeartbeat(db, {
			configVersion: "v1",
			cpu: 10,
			disk: 30,
			pids: [1, 2],
			quotaUsage: { running: 0, total: 0 },
			ram: 20,
			sandboxes: [],
			ts: 1000,
		});
		expect(countHeartbeats(db)).toBe(1);
		expect(queryHistory(db, 0).length).toBe(1);
		db.close();
	});

	test("30d retention vacuum deletes old rows only", () => {
		const db = openDb(dbPath);
		const now = Date.now();
		const old = now - 31 * 24 * 3600 * 1000;
		insertHeartbeat(db, {
			configVersion: "v1",
			cpu: 1,
			disk: 1,
			pids: [],
			quotaUsage: {},
			ram: 1,
			sandboxes: [],
			ts: old,
		});
		insertHeartbeat(db, {
			configVersion: "v1",
			cpu: 1,
			disk: 1,
			pids: [],
			quotaUsage: {},
			ram: 1,
			sandboxes: [],
			ts: now,
		});
		expect(countHeartbeats(db)).toBe(2);
		const deleted = vacuumRetention(db, 30, now);
		expect(deleted).toBe(1);
		expect(countHeartbeats(db)).toBe(1);
		db.close();
	});

	test("provider_keys long-lived, fingerprint separate from secret", () => {
		const db = openDb(dbPath);
		setProviderKey(db, "openai", "fp123", "sk-secret", 1);
		const rows = getProviderKeys(db);
		expect(rows.length).toBe(1);
		expect(rows[0]?.secret).toBe("sk-secret");
		expect(rows[0]?.fingerprint).toBe("fp123");
		db.close();
	});

	test("log_buffer buffers + drains in order", () => {
		const db = openDb(dbPath);
		bufferLog(db, "t1", "a", 1);
		bufferLog(db, "t1", "b", 2);
		const drained = drainLogBuffer(db, "t1");
		expect(drained.map((d) => d.chunk)).toEqual(["a", "b"]);
		expect(drainLogBuffer(db, "t1").length).toBe(0);
		db.close();
	});

	test("drainLogBuffer rowid cursor never deletes unread same-ms rows", () => {
		const db = openDb(dbPath);
		// Same millisecond: the old ts<=last.ts delete dropped the unread row.
		bufferLog(db, "t1", "a", 42);
		bufferLog(db, "t1", "b", 42);
		expect(drainLogBuffer(db, "t1", 1).map((d) => d.chunk)).toEqual(["a"]);
		expect(drainLogBuffer(db, "t1", 1).map((d) => d.chunk)).toEqual(["b"]);
		expect(drainLogBuffer(db, "t1").length).toBe(0);
		db.close();
	});

	test("peekLogBuffer does not delete; deleteLogBufferThrough acks sent rows", () => {
		const db = openDb(dbPath);
		bufferLog(db, "t1", "a", 1);
		bufferLog(db, "t1", "b", 2);
		const peeked = peekLogBuffer(db, "t1");
		expect(peeked.map((p) => p.chunk)).toEqual(["a", "b"]);
		expect(peekLogBuffer(db, "t1").length).toBe(2); // still buffered
		const first = peeked[0];
		expect(first).toBeDefined();
		if (first) deleteLogBufferThrough(db, "t1", first.rowid);
		expect(peekLogBuffer(db, "t1").map((p) => p.chunk)).toEqual(["b"]);
		db.close();
	});

	test("lastSandboxEventTsBatch returns latest per sandbox in one query", () => {
		const db = openDb(dbPath);
		insertSandboxEvent(db, { event: "created", sandboxId: "s1", ts: 1 });
		insertSandboxEvent(db, { event: "stopped", sandboxId: "s1", ts: 5 });
		insertSandboxEvent(db, { event: "created", sandboxId: "s2", ts: 3 });
		const batch = lastSandboxEventTsBatch(db, ["s1", "s2", "missing"]);
		expect(batch.get("s1")).toBe(5);
		expect(batch.get("s2")).toBe(3);
		expect(batch.has("missing")).toBe(false);
		expect(lastSandboxEventTsBatch(db, []).size).toBe(0);
		db.close();
	});

	test("config_receipts per-key + latest", () => {
		const db = openDb(dbPath);
		insertReceipt(db, { jobId: "j1", key: "programs", ok: true, ts: 1 });
		insertReceipt(db, {
			error: "x",
			jobId: "j1",
			key: "providers",
			ok: false,
			ts: 2,
		});
		const latest = latestReceipts(db, 5);
		expect(latest.length).toBe(2);
		expect(latest[0]?.key).toBe("providers");
		db.close();
	});
});
