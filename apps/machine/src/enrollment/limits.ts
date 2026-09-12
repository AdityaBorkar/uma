import type { Limits } from "@uma/orpc-contract";

import { loadLimits } from "./enroll.ts";

/** Fallback when no server override and no limits.json exist. */
export const DEFAULT_LIMITS: Limits = { maxRunning: 8, maxTotal: 20 };

/** Loose wire shape (AssignFrame.limits): fields may be explicitly undefined. */
export interface ServerLimitsOverride {
	cpu?: number | undefined;
	maxRunning?: number | undefined;
	maxTotal?: number | undefined;
	ram?: number | undefined;
}

export interface ResolvedLimits extends Limits {
	/** Highest-precedence layer that supplied a quota value. */
	source: "server" | "file" | "default";
}

/** Single home for quota precedence: server override > limits.json > default. */
export function resolveLimits(
	serverOverride?: ServerLimitsOverride | null,
): ResolvedLimits {
	const file = loadLimits();
	const defaults: Limits = file
		? { maxRunning: file.maxRunning, maxTotal: file.maxTotal }
		: DEFAULT_LIMITS;
	// The wire shape allows every field to be explicitly undefined; `??` handles
	// that the same as an absent field, so merge directly (no pre-normalizing).
	const merged: Limits = {
		cpu: serverOverride?.cpu ?? defaults.cpu,
		maxRunning: serverOverride?.maxRunning ?? defaults.maxRunning,
		maxTotal: serverOverride?.maxTotal ?? defaults.maxTotal,
		ram: serverOverride?.ram ?? defaults.ram,
	};
	const serverQuota =
		serverOverride?.maxRunning !== undefined ||
		serverOverride?.maxTotal !== undefined;
	return {
		...merged,
		source: serverQuota ? "server" : file ? "file" : "default",
	};
}
