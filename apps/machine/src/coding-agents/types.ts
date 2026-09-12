/**
 * Adapter data pattern for coding agents: each agent ships one adapter that
 * (a) describes itself as data (descriptor) and (b) maps its agent-owned
 * config surfaces onto the seams the config keys consume. Adding an agent =
 * one adapter class + one registry entry; switching agents at runtime =
 * UMA_CODING_AGENT=<id> (no config-key changes).
 */

/** Immutable identity + layout data for a coding agent. */
export interface CodingAgentDescriptor {
	/** Binaries that must be on PATH for the agent to run. */
	readonly bins: readonly string[];
	readonly displayName: string;
	/** Stable registry id (also the UMA_CODING_AGENT value). */
	readonly id: string;
}

/** Capability seam consumed by the config keys (files, mcp, agents). */
export interface CodingAgentAdapter {
	readonly agent: CodingAgentDescriptor;

	/**
	 * Absolute path for an agent-owned config file template name, or null when
	 * this agent does not own that file (caller falls back to the uma layout).
	 */
	configFileTarget(name: string): string | null;

	/**
	 * Subset of `want` not configured in the agent's MCP config. Throws with a
	 * remediation detail when the probe itself fails (binary missing, corrupt
	 * config); an agent with zero servers configured simply returns `want`.
	 */
	missingMcpServers(want: string[]): Promise<string[]>;
}
