import { activeCodingAgent } from "../coding-agents/registry.ts";
import type { CodingAgentAdapter } from "../coding-agents/types.ts";
import type { CheckResult, ResetOptions, ResetResult } from "./desired.ts";
import { BaseConfigKey } from "./key.ts";

export class McpKey extends BaseConfigKey {
	readonly key = "mcp";

	/**
	 * The active coding-agent adapter owns the MCP probe (CLI substring probe
	 * for opencode, mcp.json diff for omp); probe failures surface as drift.
	 */
	constructor(
		private readonly agent: CodingAgentAdapter = activeCodingAgent(),
	) {
		super();
	}

	async check(): Promise<CheckResult> {
		const { corrupt, state } = this.loadDesired();
		if (corrupt) return corrupt;
		const servers = state.mcp?.servers ?? [];
		if (servers.length === 0)
			return {
				detail: "no mcp servers declared",
				drifted: false,
				key: this.key,
			};
		let missing: string[];
		try {
			missing = await this.agent.missingMcpServers(servers);
		} catch (e) {
			return {
				detail: e instanceof Error ? e.message : String(e),
				drifted: true,
				key: this.key,
			};
		}
		if (missing.length === 0)
			return { detail: "mcp in sync", drifted: false, key: this.key };
		return {
			detail: `missing mcp: ${missing.join(",")}`,
			drifted: true,
			key: this.key,
		};
	}

	async reset(opts?: ResetOptions): Promise<ResetResult> {
		const dry = await this.maybeDryRun(opts);
		if (dry) return dry;
		const c = await this.check();
		if (!c.drifted) return { changed: false, key: this.key, ok: true };
		return {
			error: `mcp drifted: ${c.detail}. Add/remove entries via /settings/mcp instructions.`,
			key: this.key,
			ok: false,
		};
	}
}
