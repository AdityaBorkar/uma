import { join } from "node:path";

import { homeDir } from "../../utils/env.ts";
import { runCapture } from "../../utils/proc.ts";
import type { CodingAgentAdapter, CodingAgentDescriptor } from "../types.ts";

/**
 * OpenCode adapter: config at ~/.config/opencode/opencode.json, MCP servers
 * probed via the `opencode mcp list` CLI (no output-format contract, so
 * desired server names are substring-matched).
 */
export class OpenCodeAdapter implements CodingAgentAdapter {
	readonly agent: CodingAgentDescriptor = {
		bins: ["opencode"],
		displayName: "OpenCode",
		id: "opencode",
	};

	configFileTarget(name: string): string | null {
		if (name !== "opencode.json") return null;
		return join(homeDir(), ".config", "opencode", "opencode.json");
	}

	async missingMcpServers(want: string[]): Promise<string[]> {
		const r = await runCapture("opencode", ["mcp", "list"], 6000);
		if (!r) throw new Error("opencode binary missing for mcp check");
		return want.filter((s) => !r.stdout.includes(s));
	}
}
