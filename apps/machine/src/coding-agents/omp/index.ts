import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { homeDir } from "../../utils/env.ts";
import type { CodingAgentAdapter, CodingAgentDescriptor } from "../types.ts";

/**
 * oh-my-pi (omp) adapter: config root ~/.omp (PI_CONFIG_DIR), agent dir
 * ~/.omp/agent. MCP servers live in ~/.omp/agent/mcp.json as a `mcpServers`
 * map, with `disabledServers` as the user-level denylist.
 */
export class OmpAdapter implements CodingAgentAdapter {
	readonly agent: CodingAgentDescriptor = {
		bins: ["omp"],
		displayName: "oh-my-pi",
		id: "omp",
	};

	configFileTarget(name: string): string | null {
		const agentDir = join(homeDir(), ".omp", "agent");
		if (name === "config.yml") return join(agentDir, "config.yml");
		if (name === "mcp.json") return join(agentDir, "mcp.json");
		return null;
	}

	async missingMcpServers(want: string[]): Promise<string[]> {
		const have = this.configuredMcpServers();
		return want.filter((s) => !have.has(s));
	}

	/** Server names currently configured (mcpServers minus disabledServers). */
	private configuredMcpServers(): Set<string> {
		const p = join(homeDir(), ".omp", "agent", "mcp.json");
		if (!existsSync(p)) return new Set();
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(p, "utf8"));
		} catch (e) {
			throw new Error(
				`omp mcp.json unreadable: ${e instanceof Error ? e.message : String(e)}`,
			);
		}
		const obj = (parsed ?? {}) as {
			disabledServers?: unknown;
			mcpServers?: Record<string, unknown>;
		};
		const disabled = new Set(
			Array.isArray(obj.disabledServers)
				? obj.disabledServers.filter((s): s is string => typeof s === "string")
				: [],
		);
		return new Set(
			Object.keys(obj.mcpServers ?? {}).filter((n) => !disabled.has(n)),
		);
	}
}
