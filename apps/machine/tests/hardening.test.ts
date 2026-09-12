import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { isSafeFileName } from "../src/utils/fs-utils.ts";

let dir: string;
let oldEnv: Record<string, string | undefined>;

const ENV_KEYS = [
	"MSB_MOCK",
	"UMA_CONFIG_HOME",
	"UMA_DATA_HOME",
	"UMA_HOME",
	"UMA_STATE_DB",
] as const;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-hard-"));
	oldEnv = {};
	for (const k of ENV_KEYS) oldEnv[k] = process.env[k];
	process.env.UMA_CONFIG_HOME = join(dir, "config");
	process.env.UMA_DATA_HOME = join(dir, "data");
	process.env.UMA_HOME = join(dir, "home");
	process.env.UMA_STATE_DB = join(dir, "data", "state.db");
	process.env.MSB_MOCK = "1";
	mkdirSync(join(dir, "config"), { recursive: true });
});

afterEach(() => {
	for (const k of ENV_KEYS) {
		if (oldEnv[k] === undefined) delete process.env[k];
		else process.env[k] = oldEnv[k];
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("limits precedence (single resolver)", () => {
	test("default -> file -> server", async () => {
		const { resolveLimits } = await import("../src/enrollment/limits.ts");
		const { saveLimits } = await import("../src/enrollment/enroll.ts");
		expect(resolveLimits()).toMatchObject({
			maxRunning: 8,
			maxTotal: 20,
			source: "default",
		});
		saveLimits({
			computedAt: Date.now(),
			maxRunning: 2,
			maxTotal: 5,
			ramGB: 1,
			source: "install-probe",
		});
		expect(resolveLimits()).toMatchObject({
			maxRunning: 2,
			maxTotal: 5,
			source: "file",
		});
		expect(resolveLimits({ maxRunning: 9 })).toMatchObject({
			maxRunning: 9,
			maxTotal: 5,
			source: "server",
		});
	});
});

describe("desired.json corruption is surfaced", () => {
	test("programs.check reports drift on invalid JSON", async () => {
		const { desiredPath } = await import("../src/config/desired.ts");
		const { ProgramsKey } = await import("../src/config/programs.ts");
		writeFileSync(desiredPath(), "{not json");
		const c = await new ProgramsKey().check();
		expect(c.drifted).toBe(true);
		expect(c.detail).toContain("corrupt");
	});
});

describe("declared file names are path-safe", () => {
	test("isSafeFileName allowlist", () => {
		expect(isSafeFileName("opencode.json")).toBe(true);
		expect(isSafeFileName("cli.json")).toBe(true);
		expect(isSafeFileName("a/b")).toBe(false);
		expect(isSafeFileName("../x")).toBe(false);
		expect(isSafeFileName(".env")).toBe(false);
		expect(isSafeFileName("")).toBe(false);
	});

	test("files.reset refuses traversal names", async () => {
		const { saveDesired } = await import("../src/config/desired.ts");
		const { FilesKey } = await import("../src/config/files.ts");
		saveDesired({ templates: { "../../evil.txt": "x" }, version: "v1" });
		const r = await new FilesKey().reset();
		expect(r.ok).toBe(false);
		expect(r.error).toContain("unsafe file name");
	});

	test("skills.reset refuses traversal names", async () => {
		const { saveDesired } = await import("../src/config/desired.ts");
		const { SkillsKey } = await import("../src/config/skills.ts");
		saveDesired({ skills: { files: ["../../evil.md"] }, version: "v1" });
		const r = await new SkillsKey().reset();
		expect(r.ok).toBe(false);
		expect(r.error).toContain("unsafe skill name");
	});
});

describe("quota refusal frames", () => {
	test("validate against the v1 machine schema", async () => {
		const { assertMachineFrame, quotaRefusalFrames } = await import(
			"../src/execution/protocol.ts"
		);
		const frames = quotaRefusalFrames({
			limits: { maxRunning: 1, maxTotal: 2 },
			machineId: "m1",
			sandboxId: "task-t-234567",
			taskId: "t1",
			usage: { running: 1, total: 2 },
		});
		expect(frames.length).toBe(2);
		for (const f of frames) expect(() => assertMachineFrame(f)).not.toThrow();
	});
});
