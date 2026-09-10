import { describe, expect, test } from "bun:test";

import {
	AssignFrameSchema,
	branchForTask,
	effectiveLimits,
	HeartbeatFrameSchema,
	LOG_FRAME_CAP_BYTES,
	LogFrameSchema,
	MachineNameSchema,
	needsUpgrade,
	PROTOCOL_VERSION,
	parseServerFrame,
	ResetConfigFrameSchema,
	validateMachineFrame,
} from "../orpc-contract/src/index.ts";

describe("protocol v1 frozen rules", () => {
	test("protocol version frozen", () => {
		expect(PROTOCOL_VERSION).toBe("v1");
		expect(LOG_FRAME_CAP_BYTES).toBe(256 * 1024);
	});

	test("heartbeat requires quotaUsage + scopeHint (null=global)", () => {
		const ok = HeartbeatFrameSchema.safeParse({
			cliVersion: "0.1.0",
			configVersion: "v1",
			machineId: "m1",
			metrics: { cpu: 1, disk: 3, pids: [1], ram: 2 },
			protocol: "v1",
			quotaUsage: { running: 0, total: 0 },
			sandboxes: [],
			scopeHint: null,
			t: "heartbeat",
		});
		expect(ok.success).toBe(true);
		const scoped = HeartbeatFrameSchema.safeParse({
			cliVersion: "0.1.0",
			configVersion: "v1",
			machineId: "m1",
			metrics: { cpu: 1, disk: 3, pids: [1], ram: 2 },
			protocol: "v1",
			quotaUsage: { running: 1, total: 2 },
			sandboxes: [],
			scopeHint: "proj_1",
			t: "heartbeat",
		});
		expect(scoped.success).toBe(true);
	});

	test("log chunk capped at 256KB", () => {
		const big = "x".repeat(256 * 1024 + 1);
		expect(
			LogFrameSchema.safeParse({
				chunk: big,
				machineId: "m",
				protocol: "v1",
				t: "log",
				taskId: "t",
			}).success,
		).toBe(false);
		expect(
			LogFrameSchema.safeParse({
				chunk: "ok",
				machineId: "m",
				protocol: "v1",
				t: "log",
				taskId: "t",
			}).success,
		).toBe(true);
	});

	test("unknown server frames ignored (null)", () => {
		expect(parseServerFrame({ t: "bogus" })).toBeNull();
		expect(parseServerFrame(null)).toBeNull();
		expect(
			parseServerFrame({
				projectId: null,
				prompt: "hi",
				t: "assign",
				taskId: "t",
			}),
		).not.toBeNull();
	});

	test("outbound unknown never sent (validate fails)", () => {
		expect(validateMachineFrame({ machineId: "m", t: "bogus" }).success).toBe(
			false,
		);
	});

	test("reset-config full-keys + star", () => {
		const star = ResetConfigFrameSchema.safeParse({
			jobId: "j",
			keys: "*",
			t: "reset-config",
			version: "v1",
		});
		expect(star.success).toBe(true);
		const full = ResetConfigFrameSchema.safeParse({
			jobId: "j",
			keys: ["providers"],
			payload: { keys: [{ key: "sk-x", provider: "openai" }] },
			t: "reset-config",
			version: "v1",
		});
		expect(full.success).toBe(true);
	});

	test("branch defaults to task/<short>", () => {
		expect(branchForTask("task_abcdefghij")).toBe("task/taskabcd");
		expect(branchForTask("t", "custom")).toBe("custom");
		expect(
			AssignFrameSchema.parse({
				projectId: null,
				prompt: "hi",
				t: "assign",
				taskId: "t1",
			}).repoUrl,
		).toBe("");
	});

	test("limits precedence: server override wins", () => {
		expect(
			effectiveLimits({ maxRunning: 8, maxTotal: 20 }, { maxRunning: 1 }),
		).toEqual({
			cpu: undefined,
			maxRunning: 1,
			maxTotal: 20,
			ram: undefined,
		});
		expect(effectiveLimits({ maxRunning: 8, maxTotal: 20 }, null)).toEqual({
			maxRunning: 8,
			maxTotal: 20,
		});
	});

	test("UPGRADE_REQUIRED on major mismatch", () => {
		expect(needsUpgrade("0.9.0", "1.0.0")).toBe(true);
		expect(needsUpgrade("1.1.0", "1.0.0")).toBe(false);
	});

	test("reserved names rejected", () => {
		expect(MachineNameSchema.safeParse("api").success).toBe(false);
		expect(MachineNameSchema.safeParse("my-machine").success).toBe(true);
	});
});
