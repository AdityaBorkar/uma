import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type {
	AssignFrame,
	ClaimAckFrame,
	MachineFrame,
	TaskDoneFrame,
} from "../orpc-contract/src/index.ts";
import { saveIdentity } from "../src/enroll.ts";
import {
	cancelTask,
	type ExecutionDeps,
	executeTask,
} from "../src/execution.ts";
import { createSandbox, listSandboxes } from "../src/sandbox.ts";

let dir: string;
let oldEnv: Record<string, string | undefined>;

const ENV_KEYS = [
	"MSB_MOCK",
	"UMA_AGENT_BIN",
	"UMA_CONFIG_HOME",
	"UMA_DATA_HOME",
	"UMA_HOME",
	"UMA_STATE_DB",
] as const;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-exec-"));
	oldEnv = {};
	for (const k of ENV_KEYS) oldEnv[k] = process.env[k];
	process.env.UMA_CONFIG_HOME = join(dir, "config");
	process.env.UMA_DATA_HOME = join(dir, "data");
	process.env.UMA_HOME = join(dir, "home");
	process.env.UMA_STATE_DB = join(dir, "data", "state.db");
	process.env.MSB_MOCK = "1";
	delete process.env.UMA_AGENT_BIN;
	mkdirSync(join(dir, "config"), { recursive: true });
	saveIdentity({
		enrolledAt: Date.now(),
		machineId: "m-test",
		serverUrl: "http://127.0.0.1:1",
		sessionToken: "sess_test",
	});
});

afterEach(() => {
	for (const k of ENV_KEYS) {
		if (oldEnv[k] === undefined) delete process.env[k];
		else process.env[k] = oldEnv[k];
	}
	rmSync(dir, { force: true, recursive: true });
});

function assignFor(
	taskId: string,
	extra: Partial<AssignFrame> = {},
): AssignFrame {
	return {
		projectId: null,
		prompt: "do the thing",
		repoUrl: "",
		t: "assign",
		taskId,
		...extra,
	};
}

function collector(): { emit: ExecutionDeps["emit"]; frames: MachineFrame[] } {
	const frames: MachineFrame[] = [];
	return { emit: (f) => frames.push(f), frames };
}

const okClaim = async () => "ok" as const;

describe("executeTask completes the claimed lifecycle", () => {
	test("completed: claim-ack, task-done completed, sandbox left stopped", async () => {
		const { emit, frames } = collector();
		const outcome = await executeTask(assignFor("task_done"), {
			agentBin: "true",
			claim: okClaim,
			emit,
		});

		expect(outcome).toEqual({
			sandboxId: expect.any(String),
			status: "completed",
		});
		const ack = frames.find((f) => f.t === "claim-ack") as ClaimAckFrame;
		expect(ack.ok).toBe(true);
		const done = frames.find((f) => f.t === "task-done") as TaskDoneFrame;
		expect(done.status).toBe("completed");
		if (outcome.status === "refused") throw new Error("unreachable");
		const list = await listSandboxes();
		expect(list.find((s) => s.id === outcome.sandboxId)?.status).toBe(
			"stopped",
		);
	});

	test("failed exec: task-done failed, sandbox left stopped", async () => {
		const { emit, frames } = collector();
		const outcome = await executeTask(assignFor("task_fail"), {
			agentBin: "false",
			claim: okClaim,
			emit,
		});

		expect(outcome.status).toBe("failed");
		const done = frames.find((f) => f.t === "task-done") as TaskDoneFrame;
		expect(done.status).toBe("failed");
	});

	test("fail closed when no agent is configured", async () => {
		const { emit, frames } = collector();
		const outcome = await executeTask(assignFor("task_noagent"), {
			claim: okClaim,
			emit,
		});

		expect(outcome.status).toBe("failed");
		const systems = frames.filter(
			(f) => f.t === "log" && f.stream === "system",
		);
		expect(
			systems.some(
				(f) => f.t === "log" && f.chunk.includes("no agent configured"),
			),
		).toBe(true);
		expect(
			frames.some((f) => f.t === "task-done" && f.status === "failed"),
		).toBe(true);
		expect(
			frames.some((f) => f.t === "task-done" && f.status === "completed"),
		).toBe(false);
	});

	test("cancel mid-run: outcome cancelled and no task-done", async () => {
		const { emit, frames } = collector();
		// run with prompt "1" so sleep holds the exec open long enough to cancel
		const run = executeTask(assignFor("task_cancel", { prompt: "1" }), {
			agentBin: "sleep",
			claim: okClaim,
			emit,
		});
		void run.catch(() => {});

		let found = false;
		for (let i = 0; i < 200 && !found; i++) {
			await Bun.sleep(10);
			found = (await listSandboxes()).some((s) => s.taskId === "task_cancel");
		}
		expect(found).toBe(true);
		expect(await cancelTask("task_cancel")).toBe(true);
		const outcome = await run;
		expect(outcome.status).toBe("cancelled");
		expect(frames.some((f) => f.t === "task-done")).toBe(false);
	});
});

describe("executeTask rejects and frees", () => {
	test("server rejection: reason server, sandbox freed", async () => {
		const { emit, frames } = collector();
		const outcome = await executeTask(assignFor("task_rej"), {
			agentBin: "true",
			claim: async () => "rejected",
			emit,
		});

		expect(outcome).toMatchObject({ reason: "server", status: "rejected" });
		if (outcome.status !== "rejected") throw new Error("unreachable");
		const ack = frames.find((f) => f.t === "claim-ack") as ClaimAckFrame;
		expect(ack).toMatchObject({ error: "CLAIM_REJECTED", ok: false });
		const list = await listSandboxes();
		expect(list.some((s) => s.id === outcome.sandboxId)).toBe(false);
	});

	test("unreachable claim: reason unreachable, sandbox freed", async () => {
		const { emit, frames } = collector();
		const outcome = await executeTask(assignFor("task_net"), {
			agentBin: "true",
			claim: async () => "unreachable",
			emit,
		});

		expect(outcome).toMatchObject({
			reason: "unreachable",
			status: "rejected",
		});
		const ack = frames.find((f) => f.t === "claim-ack") as ClaimAckFrame;
		expect(ack).toMatchObject({ error: "CLAIM_UNREACHABLE", ok: false });
	});

	test("a throwing claim rethrows after cleanup", async () => {
		const { emit } = collector();
		await expect(
			executeTask(assignFor("task_boom"), {
				agentBin: "true",
				claim: async () => {
					throw new Error("boom");
				},
				emit,
			}),
		).rejects.toThrow("boom");
		const list = await listSandboxes();
		expect(list.some((s) => s.taskId === "task_boom")).toBe(false);
	});
});

describe("executeTask admission", () => {
	test("quota refusal emits both refusal frames and never claims", async () => {
		await createSandbox({
			name: "task-blocker-234567",
			projectId: null,
			taskId: "blocker",
		});
		const { emit, frames } = collector();
		let claimed = false;
		const outcome = await executeTask(
			assignFor("task_over", {
				limits: { maxRunning: 1, maxTotal: 1 },
			}),
			{
				agentBin: "true",
				claim: async () => {
					claimed = true;
					return "ok";
				},
				emit,
			},
		);

		expect(outcome).toEqual({
			limits: expect.objectContaining({ maxRunning: 1, maxTotal: 1 }),
			status: "refused",
			usage: { running: 0, total: 1 },
		});
		expect(claimed).toBe(false);
		expect(frames.map((f) => f.t)).toEqual(["quota-exceeded", "claim-ack"]);
		expect(frames[1]).toMatchObject({ error: "QUOTA_EXCEEDED", ok: false });
	});
});
