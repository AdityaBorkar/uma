import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let dir: string;
let oldEnv: Record<string, string | undefined>;

const ENV_KEYS = ["UMA_CODING_AGENT", "UMA_HOME"] as const;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "uma-agents-"));
	oldEnv = {};
	for (const k of ENV_KEYS) oldEnv[k] = process.env[k];
	process.env.UMA_HOME = dir;
	delete process.env.UMA_CODING_AGENT;
});

afterEach(() => {
	for (const k of ENV_KEYS) {
		if (oldEnv[k] === undefined) delete process.env[k];
		else process.env[k] = oldEnv[k];
	}
	rmSync(dir, { force: true, recursive: true });
});

describe("coding-agent registry", () => {
	test("known ids resolve; unknown id throws", async () => {
		const { CODING_AGENT_IDS, resolveCodingAgent } = await import(
			"../src/coding-agents/registry.ts"
		);
		expect(CODING_AGENT_IDS).toEqual(["omp", "opencode"]);
		expect(resolveCodingAgent("opencode").agent.id).toBe("opencode");
		expect(resolveCodingAgent("omp").agent.id).toBe("omp");
		expect(() => resolveCodingAgent("nope")).toThrow(/unknown coding agent/);
	});

	test("UMA_CODING_AGENT selects the active adapter", async () => {
		const { activeCodingAgent } = await import(
			"../src/coding-agents/registry.ts"
		);
		expect(activeCodingAgent().agent.id).toBe("opencode"); // default
		process.env.UMA_CODING_AGENT = "OMP"; // case-insensitive
		expect(activeCodingAgent().agent.id).toBe("omp");
	});
});

describe("adapter data pattern", () => {
	test("each adapter owns its agent config files, not uma's", async () => {
		const { OpenCodeAdapter } = await import(
			"../src/coding-agents/opencode/index.ts"
		);
		const { OmpAdapter } = await import("../src/coding-agents/omp/index.ts");
		expect(new OpenCodeAdapter().configFileTarget("opencode.json")).toBe(
			join(dir, ".config", "opencode", "opencode.json"),
		);
		expect(new OmpAdapter().configFileTarget("mcp.json")).toBe(
			join(dir, ".omp", "agent", "mcp.json"),
		);
		expect(new OmpAdapter().configFileTarget("config.yml")).toBe(
			join(dir, ".omp", "agent", "config.yml"),
		);
		// uma-owned files fall back to the uma layout (null from the adapter).
		expect(new OmpAdapter().configFileTarget("cli.json")).toBeNull();
		expect(new OpenCodeAdapter().configFileTarget("cli.json")).toBeNull();
	});

	test("omp mcp probe diffs desired servers against mcp.json", async () => {
		const agentDir = join(dir, ".omp", "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(
			join(agentDir, "mcp.json"),
			JSON.stringify({
				disabledServers: ["b"],
				mcpServers: { a: { command: "x" }, b: { command: "y" } },
			}),
		);
		const { OmpAdapter } = await import("../src/coding-agents/omp/index.ts");
		// "b" is in disabledServers => not configured => missing; same for "c".
		expect(await new OmpAdapter().missingMcpServers(["a", "b", "c"])).toEqual([
			"b",
			"c",
		]);
	});

	test("omp missing mcp.json means every desired server is missing", async () => {
		const { OmpAdapter } = await import("../src/coding-agents/omp/index.ts");
		expect(await new OmpAdapter().missingMcpServers(["a"])).toEqual(["a"]);
	});

	test("omp corrupt mcp.json surfaces as a probe failure", async () => {
		const agentDir = join(dir, ".omp", "agent");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(join(agentDir, "mcp.json"), "{nope");
		const { OmpAdapter } = await import("../src/coding-agents/omp/index.ts");
		await expect(new OmpAdapter().missingMcpServers(["a"])).rejects.toThrow(
			/mcp.json unreadable/,
		);
	});

	test("files key routes agent-owned templates via the active adapter", async () => {
		process.env.UMA_CODING_AGENT = "omp";
		const { FilesKey } = await import("../src/config/files.ts");
		expect(new FilesKey().targetPath("mcp.json")).toBe(
			join(dir, ".omp", "agent", "mcp.json"),
		);
		expect(new FilesKey().targetPath("cli.json")).toBe(
			join(dir, ".config", "uma", "cli.json"),
		);
	});
});
