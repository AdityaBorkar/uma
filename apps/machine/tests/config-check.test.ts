import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let dir: string;
let oldEnv: Record<string, string | undefined>;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-cfg-"));
	oldEnv = {
		MSB_MOCK: process.env.MSB_MOCK,
		UMA_CONFIG_HOME: process.env.UMA_CONFIG_HOME,
		UMA_DATA_HOME: process.env.UMA_DATA_HOME,
		UMA_STATE_DB: process.env.UMA_STATE_DB,
	};
	process.env.UMA_CONFIG_HOME = join(dir, "config");
	process.env.UMA_DATA_HOME = join(dir, "data");
	process.env.UMA_STATE_DB = join(dir, "data", "state.db");
	process.env.MSB_MOCK = "1";
});

afterEach(() => {
	for (const [k, v] of Object.entries(oldEnv)) {
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("config check (linger, doctor, fingerprint-only)", () => {
	test("checkAll returns all 9 keys in dependency order", async () => {
		const { checkAll, ORDERED_KEYS } = await import("../src/config/mod.ts");
		expect(ORDERED_KEYS.map((m) => m.KEY)).toEqual([
			"programs",
			"git-login",
			"adityab-agent",
			"agents",
			"files",
			"providers",
			"mcp",
			"skills",
			"systemd",
		]);
		const results = await checkAll();
		expect(results.length).toBe(9);
		for (const r of results) {
			expect(typeof r.key).toBe("string");
			expect(typeof r.drifted).toBe("boolean");
		}
	});

	test("providers check is fingerprint-only (never prints secret)", async () => {
		const { saveDesired } = await import("../src/config/desired.ts");
		const { fingerprint } = await import("../src/redact.ts");
		const { openDb, setProviderKey } = await import("../src/db.ts");
		const { check } = await import("../src/config/providers.ts");
		const secret = "sk-live-1234567890";
		saveDesired({
			providers: {
				providers: [{ fingerprint: fingerprint(secret), provider: "openai" }],
			},
			version: "v1",
		});
		const db = openDb(process.env.UMA_STATE_DB as string);
		setProviderKey(db, "openai", fingerprint(secret), secret, Date.now());
		db.close();
		const c = await check();
		expect(c.drifted).toBe(false);
		expect(JSON.stringify(c)).not.toContain("sk-live");
	});

	test("providers reset writes full-keys push", async () => {
		const { reset } = await import("../src/config/providers.ts");
		const { openDb, getProviderSecret } = await import("../src/db.ts");
		const r = await reset({
			payload: { keys: [{ key: "sk-new-key", provider: "openai" }] },
		});
		expect(r.ok).toBe(true);
		const db = openDb(process.env.UMA_STATE_DB as string, true);
		expect(getProviderSecret(db, "openai")).toBe("sk-new-key");
		db.close();
	});

	test("systemd check owns lingering (fails cleanly without linger)", async () => {
		const { check } = await import("../src/config/systemd.ts");
		const c = await check();
		expect(c.key).toBe("systemd");
		expect(typeof c.drifted).toBe("boolean");
	});

	test("sync writes per-key receipts (non-dry-run)", async () => {
		const { performSync } = await import("../src/sync.ts");
		const { openDb, latestReceipts } = await import("../src/db.ts");
		const { jobId, receipts } = await performSync({ dryRun: false });
		expect(jobId.startsWith("local-")).toBe(true);
		expect(receipts.length).toBe(9);
		const db = openDb(process.env.UMA_STATE_DB as string, true);
		expect(latestReceipts(db, 20).length).toBe(9);
		db.close();
	}, 20_000);
});
