import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let dir: string;
let oldEnv: Record<string, string | undefined>;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-git-"));
	oldEnv = {
		MSB_MOCK: process.env.MSB_MOCK,
		UMA_DATA_HOME: process.env.UMA_DATA_HOME,
	};
	process.env.UMA_DATA_HOME = join(dir, "data");
	process.env.MSB_MOCK = "1";
});

afterEach(() => {
	for (const [k, v] of Object.entries(oldEnv)) {
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("git-binding (SDK exec, Ubuntu sandbox)", () => {
	test("notes-only when repoUrl empty (no clone)", async () => {
		const { ensureBinding } = await import("../src/execution/git-binding.ts");
		const { Sandbox } = await import("../src/sandboxes/sandbox.ts");
		const { name } = await Sandbox.create({
			name: `gb-${Date.now().toString(36)}`,
			projectId: null,
			taskId: "t1",
		});
		const r = await ensureBinding({
			repoUrl: "",
			sandboxName: name,
			taskId: "task_abcdef12",
		});
		expect(r.notesOnly).toBe(true);
		expect(r.branch).toBe("task/taskabcd");
	});

	test("branchForTask pinning", async () => {
		const { ensureBinding } = await import("../src/execution/git-binding.ts");
		const { Sandbox } = await import("../src/sandboxes/sandbox.ts");
		// Mock exec runs on host; use `true` binary via sh to simulate clone path
		// without network: absent .git check uses ~/work which won't exist on host,
		// so clone would fail — instead assert notes-only + branch math only.
		const { name } = await Sandbox.create({
			name: `gb2-${Date.now().toString(36)}`,
			projectId: null,
			taskId: "t2",
		});
		const r = await ensureBinding({
			branch: "custom-br",
			repoUrl: "",
			sandboxName: name,
			taskId: "xyz",
		});
		expect(r.branch).toBe("custom-br");
	});
});
