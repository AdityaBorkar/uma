import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	branchForTask,
	deviceCode,
	sessionToken,
	userCode,
} from "@uma/orpc-contract";

import { sandboxNameFor } from "../src/execution/execution.ts";
import { validateSandboxName } from "../src/sandboxes/sandbox.ts";

const SANDBOX_RE =
	/^task-[A-Za-z0-9-]{1,8}-[23456789abcdefghijkmnopqrstuvwxyz]{6}$/;
const UPPER_NL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let dir: string;
let oldEnv: Record<string, string | undefined>;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-nanoid-"));
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

describe("nanoid migration", () => {
	test("sandboxNameFor keeps task-<short>-<rand6> shape, deterministic length", () => {
		const n = sandboxNameFor("task_abcdefghij");
		expect(n).toMatch(SANDBOX_RE);
		expect(n.startsWith("task-taskabcd-")).toBe(true);
		expect(n.split("-").at(-1)?.length).toBe(6);
		expect(() => validateSandboxName(n)).not.toThrow();
		// Empty/sanitized input falls back to "task" short.
		expect(sandboxNameFor("!!!")).toMatch(
			/^task-task-[23456789abcdefghijkmnopqrstuvwxyz]{6}$/,
		);
	});

	test("sandboxNameFor is collision-resistant over bursts", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) seen.add(sandboxNameFor("same-task-id"));
		expect(seen.size).toBe(1000);
	});

	test("validateSandboxName rejects traversal, separators, and dots", () => {
		for (const bad of [
			"../etc",
			"a/b",
			".",
			"..",
			"",
			"a b",
			"a".repeat(129),
			"a.b",
		]) {
			expect(() => validateSandboxName(bad)).toThrow();
		}
		expect(() => validateSandboxName("task-abc-234567")).not.toThrow();
	});

	test("sync jobId keeps local- prefix with timestamp + nanoid suffix", async () => {
		const { performSync } = await import("../src/config/sync.ts");
		const a = await performSync({ dryRun: true });
		const b = await performSync({ dryRun: true });
		for (const { jobId } of [a, b]) {
			expect(jobId.startsWith("local-")).toBe(true);
			expect(jobId).toMatch(/^local-\d+-[A-Za-z0-9_-]{6}$/);
		}
		expect(a.jobId).not.toBe(b.jobId);
	});

	test("branchForTask unchanged (no RNG): task/<short>", () => {
		expect(branchForTask("task_abcdefghij")).toBe("task/taskabcd");
		expect(branchForTask("t", "custom")).toBe("custom");
	});

	test("wire ids preserve prefixes/lengths/formats", () => {
		const d = deviceCode();
		expect(d).toMatch(/^dev_[A-Z2-9]{24}$/);
		expect(d.length).toBe(4 + 24);
		const u = userCode();
		expect(u).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		for (const ch of u.replace("-", "")) expect(UPPER_NL).toContain(ch);
		expect(sessionToken()).toMatch(/^sess_[A-Z2-9]{32}$/);
	});

	test("user_codes unique over bursts", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) seen.add(userCode());
		expect(seen.size).toBe(200);
	});
});
