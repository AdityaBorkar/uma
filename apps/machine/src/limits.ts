import { effectiveLimits, type Limits } from "@uma/orpc-contract";

import { loadLimits } from "./enroll.ts";

/** Fallback when no server override and no limits.json exist. */
export const DEFAULT_LIMITS: Limits = { maxRunning: 8, maxTotal: 20 };

export interface ResolvedLimits extends Limits {
	/** Highest-precedence layer that supplied a quota value. */
	source: "server" | "file" | "default";
}

/** Single home for quota precedence: server override > limits.json > default. */
export function resolveLimits(
	serverOverride?: Partial<Limits> | null,
): ResolvedLimits {
	const file = loadLimits();
	const defaults: Limits = file
		? { maxRunning: file.maxRunning, maxTotal: file.maxTotal }
		: DEFAULT_LIMITS;
	const merged = effectiveLimits(defaults, serverOverride);
	const serverQuota =
		serverOverride?.maxRunning !== undefined ||
		serverOverride?.maxTotal !== undefined;
	return {
		...merged,
		source: serverQuota ? "server" : file ? "file" : "default",
	};
}
