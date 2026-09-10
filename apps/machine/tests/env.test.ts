import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

const KEYS = [
	"UMA_CONFIG_HOME",
	"UMA_MACHINE_ROOT",
	"UMA_DATA_HOME",
	"XDG_CONFIG_HOME",
	"XDG_DATA_HOME",
] as const;

const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

afterEach(() => {
	for (const k of KEYS) {
		if (saved[k] === undefined) delete process.env[k];
		else process.env[k] = saved[k];
	}
});

function cleanEnv() {
	for (const k of KEYS) delete process.env[k];
}

describe("env (XDG + UMA_* overrides)", () => {
	test("UMA_CONFIG_HOME is the full dir; UMA_DATA_HOME is the full dir", async () => {
		cleanEnv();
		process.env.UMA_CONFIG_HOME = "/tmp/x/conf";
		process.env.UMA_DATA_HOME = "/tmp/x/data";
		const { configDir, dataDir } = await import("../src/env.ts");
		expect(configDir()).toBe("/tmp/x/conf");
		expect(dataDir()).toBe("/tmp/x/data");
	});

	test("UMA_MACHINE_ROOT backs both dirs", async () => {
		cleanEnv();
		process.env.UMA_MACHINE_ROOT = "/tmp/x/root";
		const { configDir, dataDir } = await import("../src/env.ts");
		expect(configDir()).toBe("/tmp/x/root");
		expect(dataDir()).toBe(join("/tmp/x/root", "data"));
	});

	test("XDG bases join the uma-machine leaf", async () => {
		cleanEnv();
		process.env.XDG_CONFIG_HOME = "/tmp/x/cfg";
		process.env.XDG_DATA_HOME = "/tmp/x/dat";
		const { configDir, dataDir } = await import("../src/env.ts");
		expect(configDir()).toBe(join("/tmp/x/cfg", "uma-machine"));
		expect(dataDir()).toBe(join("/tmp/x/dat", "uma-machine"));
	});

	test("home fallback", async () => {
		cleanEnv();
		const { configDir, dataDir } = await import("../src/env.ts");
		expect(configDir()).toBe(join(homedir(), ".config", "uma-machine"));
		expect(dataDir()).toBe(join(homedir(), ".local", "share", "uma-machine"));
	});
});
