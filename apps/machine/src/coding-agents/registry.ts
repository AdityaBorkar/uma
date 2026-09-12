import { OmpAdapter } from "./omp/index.ts";
import { OpenCodeAdapter } from "./opencode/index.ts";
import type { CodingAgentAdapter } from "./types.ts";

/** Agent factories keyed by descriptor id. Register new agents here. */
const REGISTRY: Record<string, () => CodingAgentAdapter> = {
	omp: () => new OmpAdapter(),
	opencode: () => new OpenCodeAdapter(),
};

export const CODING_AGENT_IDS = Object.keys(REGISTRY).sort();

/** Active agent id: UMA_CODING_AGENT (case-insensitive), default opencode. */
export function codingAgentId(): string {
	const raw = process.env.UMA_CODING_AGENT?.trim().toLowerCase();
	return raw && raw !== "" ? raw : "opencode";
}

/** Resolve the adapter for an explicit id (defaults to the active agent). */
export function resolveCodingAgent(id?: string): CodingAgentAdapter {
	const id_ = id ?? codingAgentId();
	const factory = REGISTRY[id_];
	if (!factory) {
		throw new Error(
			`unknown coding agent '${id_}' (known: ${CODING_AGENT_IDS.join(", ")})`,
		);
	}
	return factory();
}

/** Adapter for the active agent (UMA_CODING_AGENT selection). */
export function activeCodingAgent(): CodingAgentAdapter {
	return resolveCodingAgent();
}
