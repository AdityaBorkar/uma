import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let dir: string;
let oldEnv: Record<string, string | undefined>;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-sync-"));
	oldEnv = {
		MSB_MOCK: process.env.MSB_MOCK,
		UMA_CONFIG_HOME: process.env.UMA_CONFIG_HOME,
		UMA_DATA_HOME: process.env.UMA_DATA_HOME,
		UMA_HOME: process.env.UMA_HOME,
		UMA_STATE_DB: process.env.UMA_STATE_DB,
	};
	process.env.UMA_CONFIG_HOME = join(dir, "config");
	process.env.UMA_DATA_HOME = join(dir, "data");
	process.env.UMA_STATE_DB = join(dir, "data", "state.db");
	process.env.UMA_HOME = join(dir, "home");
	process.env.MSB_MOCK = "1";
});

afterEach(() => {
	for (const [k, v] of Object.entries(oldEnv)) {
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("sync (Perform Sync)", () => {
	test("dry-run previews without persisting receipts", async () => {
		const { performSync } = await import("../src/config/sync.ts");
		const { openDb, latestReceipts } = await import("../src/utils/db.ts");
		const { existsSync } = await import("node:fs");
		const { receipts } = await performSync({ dryRun: true });
		expect(receipts.length).toBe(8);
		// Dry-run must not create or write the DB at all.
		expect(existsSync(process.env.UMA_STATE_DB as string)).toBe(false);
		if (existsSync(process.env.UMA_STATE_DB as string)) {
			const db = openDb(process.env.UMA_STATE_DB as string, true);
			try {
				expect(latestReceipts(db, 20).length).toBe(0);
			} finally {
				db.close();
			}
		}
	});

	test("real sync persists per-key receipts", async () => {
		const { performSync } = await import("../src/config/sync.ts");
		const { openDb, latestReceipts } = await import("../src/utils/db.ts");
		const { receipts } = await performSync({ dryRun: false });
		expect(receipts.length).toBe(8);
		const db = openDb(process.env.UMA_STATE_DB as string, true);
		try {
			expect(latestReceipts(db, 20).length).toBe(8);
		} finally {
			db.close();
		}
	}, 20_000);
});

describe("heartbeat history", () => {
	test("missing DB returns empty history (no throw)", async () => {
		const { readHistory } = await import("../src/daemon/heartbeat.ts");
		// UMA_STATE_DB points at a path that does not exist yet.
		expect(readHistory("24h")).toEqual([]);
	});
});

describe("providers secret refs", () => {
	test("known providers map to guest var + hosts; unknown fail closed", async () => {
		const { buildSecretSpecs, hostVarFor } = await import(
			"../src/config/providers.ts"
		);
		const specs = buildSecretSpecs([
			{ provider: "openai", secret: "sk-x" },
			{ provider: "mystery", secret: "zzz" },
		]);
		expect(specs.length).toBe(1);
		expect(specs[0]?.guestVar).toBe("OPENAI_API_KEY");
		expect(specs[0]?.hostVar).toBe(hostVarFor("openai"));
		expect(specs[0]?.hosts).toEqual(["api.openai.com"]);
		expect(specs[0]?.value).toBe("sk-x");
	});
});

describe("db aux retention + reap age", () => {
	test("pruneAuxTables drops old events/receipts/buffered logs", async () => {
		const {
			openDb,
			insertSandboxEvent,
			insertReceipt,
			bufferLog,
			pruneAuxTables,
			latestReceipts,
			bufferedLogCount,
		} = await import("../src/utils/db.ts");
		const { sandboxEvents, logBuffer } = await import(
			"../src/schemas/db/index.ts"
		);
		const { count, asc } = await import("drizzle-orm");
		const db = openDb(join(dir, "aux.db"));
		const now = Date.now();
		const old = now - 100 * 24 * 3600 * 1000;
		insertSandboxEvent(db, {
			event: "stopped",
			sandboxId: "s1",
			taskId: "t",
			ts: old,
		});
		insertSandboxEvent(db, {
			event: "created",
			sandboxId: "s2",
			taskId: "t",
			ts: now,
		});
		insertReceipt(db, { jobId: "j", key: "k", ok: true, ts: old });
		bufferLog(db, "t", "old", old);
		bufferLog(db, "t", "new", now);
		pruneAuxTables(db, now);
		const evCount = db.select({ c: count() }).from(sandboxEvents).all()[0]?.c;
		expect(Number(evCount)).toBe(1);
		expect(latestReceipts(db, 10).length).toBe(0);
		expect(bufferedLogCount(db, "t")).toBe(1);
		const logRows = db
			.select({ chunk: logBuffer.chunk })
			.from(logBuffer)
			.orderBy(asc(logBuffer.ts))
			.all();
		expect(logRows.map((l) => l.chunk)).toEqual(["new"]);
		db.close();
	});

	test("lastSandboxEventTs tracks latest event per sandbox", async () => {
		const { openDb, insertSandboxEvent, lastSandboxEventTs } = await import(
			"../src/utils/db.ts"
		);
		const db = openDb(join(dir, "ev.db"));
		expect(lastSandboxEventTs(db, "nope")).toBeNull();
		insertSandboxEvent(db, { event: "created", sandboxId: "s", ts: 100 });
		insertSandboxEvent(db, { event: "stopped", sandboxId: "s", ts: 200 });
		expect(lastSandboxEventTs(db, "s")).toBe(200);
		db.close();
	});
});

describe("enroll validation", () => {
	test("reserved/invalid names rejected before any network", async () => {
		const { enroll } = await import("../src/enrollment/enroll.ts");
		await expect(
			enroll({ machineName: "api", server: "http://127.0.0.1:9" }),
		).rejects.toThrow(/invalid machine name/);
		await expect(
			enroll({ machineName: "BAD NAME!", server: "http://127.0.0.1:9" }),
		).rejects.toThrow(/invalid machine name/);
	});
});
