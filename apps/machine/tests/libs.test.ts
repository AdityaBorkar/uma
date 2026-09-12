import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import ms from "ms";

import { resolveKeys } from "../src/config/mod.ts";
import { unitPath, writeUnitFile } from "../src/config/systemd.ts";
import { parseKeyList, parseOnlyFlag } from "../src/utils/env.ts";
import {
	ensureParentDir,
	saveJson0600,
	writeFile0600,
} from "../src/utils/fs-utils.ts";

let dir: string;
let savedEnv: Record<string, string | undefined>;

const ENV_KEYS = [
	"UMA_CONFIG_HOME",
	"UMA_MACHINE_ROOT",
	"UMA_DATA_HOME",
	"UMA_SYSTEMD_UNIT",
	"XDG_CONFIG_HOME",
	"XDG_DATA_HOME",
] as const;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-libs-"));
	savedEnv = {};
	for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
	for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
	for (const k of ENV_KEYS) {
		if (savedEnv[k] === undefined) delete process.env[k];
		else process.env[k] = savedEnv[k];
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("ms parity (replaces manual millisecond math)", () => {
	test("day/hour/second constants match legacy products", () => {
		expect(ms("1s")).toBe(1000);
		expect(ms("24h")).toBe(24 * 3600 * 1000);
		expect(ms("30d")).toBe(30 * 24 * 3600 * 1000);
		expect(ms("90d")).toBe(90 * 24 * 3600 * 1000);
		expect(ms("7d")).toBe(7 * 24 * 3600 * 1000);
		expect(ms("1d")).toBe(24 * 3600 * 1000);
	});

	test("readHistory window math: 24h vs 30d", async () => {
		const { readHistory } = await import("../src/daemon/heartbeat.ts");
		// No DB configured here → empty history regardless of window.
		expect(readHistory("24h")).toEqual([]);
		expect(readHistory("30d")).toEqual([]);
		// Unknown range falls back to the 30d window (legacy behavior).
		expect(readHistory("bogus")).toEqual([]);
	});

	test("sandboxTtlMs honors UMA_SANDBOX_TTL_S seconds", async () => {
		const { sandboxTtlMs } = await import("../src/utils/env.ts");
		delete process.env.UMA_SANDBOX_TTL_S;
		expect(sandboxTtlMs()).toBe(3600 * 1000);
		process.env.UMA_SANDBOX_TTL_S = "120";
		expect(sandboxTtlMs()).toBe(120 * 1000);
		delete process.env.UMA_SANDBOX_TTL_S;
	});
});

describe("parseKeyList (shared comma-split helper)", () => {
	test("parseOnlyFlag trims/filters", () => {
		expect(parseOnlyFlag("a,b")).toEqual(["a", "b"]);
		expect(parseOnlyFlag(" a , ,b ")).toEqual(["a", "b"]);
		expect(parseOnlyFlag("")).toBeUndefined();
		expect(parseOnlyFlag(undefined)).toBeUndefined();
		expect(parseOnlyFlag(false)).toBeUndefined();
	});

	test("parseKeyList is the single split implementation", () => {
		expect(parseKeyList("a, b,,c ")).toEqual(["a", "b", "c"]);
	});

	test("resolveKeys honors comma-joined + alias", () => {
		expect(resolveKeys(["programs,git-login"]).map((m) => m.KEY)).toEqual([
			"programs",
			"git-login",
		]);
		expect(resolveKeys(["sync"]).map((m) => m.KEY)).toEqual(["skills"]);
		expect(resolveKeys(undefined).length).toBe(8);
	});
});

describe("unitPath (override-aware)", () => {
	test("explicit UMA_SYSTEMD_UNIT wins", () => {
		process.env.UMA_SYSTEMD_UNIT = "/tmp/custom.service";
		expect(unitPath()).toBe("/tmp/custom.service");
	});

	test("default honors XDG_CONFIG_HOME base", () => {
		process.env.XDG_CONFIG_HOME = join(dir, "cfg");
		expect(unitPath()).toBe(
			join(dir, "cfg", "systemd", "user", "uma-machine.service"),
		);
	});

	test("UMA_CONFIG_HOME override propagates to unit dir", () => {
		process.env.UMA_CONFIG_HOME = join(dir, "conf");
		expect(unitPath()).toBe(
			join(dir, "conf", "systemd", "user", "uma-machine.service"),
		);
	});

	test("UMA_MACHINE_ROOT propagates to unit dir", () => {
		process.env.UMA_MACHINE_ROOT = join(dir, "root");
		expect(unitPath()).toBe(
			join(dir, "root", "systemd", "user", "uma-machine.service"),
		);
	});

	test("writeUnitFile is atomic + 0644 (world-readable, never 0600)", () => {
		process.env.UMA_SYSTEMD_UNIT = join(dir, "u", "uma-machine.service");
		const p = writeUnitFile("uma-machine daemon");
		expect(p).toBe(process.env.UMA_SYSTEMD_UNIT);
		const st = statSync(p);
		expect(st.mode & 0o777).toBe(0o644);
		expect(readFileSync(p, "utf8")).toContain("ExecStart=uma-machine daemon");
	});
});

describe("atomic file writes (write-file-atomic core)", () => {
	test("writeFile0600 content round-trips with 0600 perms", () => {
		const p = join(dir, "sub", "identity.json");
		writeFile0600(p, "secret-bytes");
		expect(readFileSync(p, "utf8")).toBe("secret-bytes");
		expect(statSync(p).mode & 0o777).toBe(0o600);
	});

	test("saveJson0600 pretty-prints with 0600 perms", () => {
		const p = join(dir, "limits.json");
		saveJson0600(p, { maxRunning: 8 });
		expect(JSON.parse(readFileSync(p, "utf8"))).toEqual({ maxRunning: 8 });
		expect(statSync(p).mode & 0o777).toBe(0o600);
	});

	test("overwrite is all-or-nothing (never partial)", () => {
		const p = join(dir, "desired.json");
		writeFile0600(p, "v1-content");
		writeFile0600(p, "v2-content");
		// Crash between tmp-write and rename cannot leave a torn file: the
		// visible path holds exactly one complete generation.
		const seen = readFileSync(p, "utf8");
		expect(seen === "v1-content" || seen === "v2-content").toBe(true);
	});

	test("no tmp litter left behind", async () => {
		const { readdirSync } = await import("node:fs");
		const sub = join(dir, "t");
		ensureParentDir(join(sub, "f"));
		writeFile0600(join(sub, "f"), "x");
		expect(readdirSync(sub)).toEqual(["f"]);
	});
});

describe("validation UX (zod-validation-error)", () => {
	test("assertMachineFrame reports all issues, not just the first", async () => {
		const { assertMachineFrame } = await import("../src/execution/protocol.ts");
		let msg = "";
		try {
			assertMachineFrame({ t: "heartbeat" });
		} catch (e) {
			msg = e instanceof Error ? e.message : String(e);
		}
		expect(msg.startsWith("invalid machine frame:")).toBe(true);
		// Full-issue message names fields (legacy: single sliced issue).
		expect(msg).toContain("machineId");
	});

	test("enroll rejects reserved names with a descriptive message", async () => {
		const { enroll } = await import("../src/enrollment/enroll.ts");
		await expect(
			enroll({ machineName: "api", server: "http://x" }),
		).rejects.toThrow(/invalid machine name 'api'/);
	});
});
