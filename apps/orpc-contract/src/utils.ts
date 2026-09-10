import { clean, coerce, compare, lt, valid } from "semver";
import type { Limits } from "./primitives.ts";

/** Branch default: task/<short> unless explicit. */
export function branchForTask(taskId: string, explicit?: string): string {
	if (explicit && explicit.length > 0) return explicit;
	const short = taskId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "task";
	return `task/${short}`;
}

/** Effective limits: server override wins over install defaults. */
export function effectiveLimits(
	defaults: Limits,
	override?: Partial<Limits> | null,
): Limits {
	if (!override) return defaults;
	return {
		cpu: override.cpu ?? defaults.cpu,
		maxRunning: override.maxRunning ?? defaults.maxRunning,
		maxTotal: override.maxTotal ?? defaults.maxTotal,
		ram: override.ram ?? defaults.ram,
	};
}

/** Compute install quota defaults from host RAM: 2x / 5x per GB, floor 1. */
export function quotaDefaultsFromRam(ramGB: number): Limits {
	const gb = Math.max(1, Math.floor(ramGB));
	return {
		maxRunning: Math.max(1, 2 * gb),
		maxTotal: Math.max(1, 5 * gb),
	};
}

/** Normalize free-form input to a semver string, or null if unparseable. */
function toSemver(v: string): string | null {
	const t = v.trim();
	return valid(t) ?? clean(t) ?? coerce(t)?.version ?? null;
}

/** Naive numeric fallback for non-semver inputs (preserves legacy behavior). */
function compareNaive(a: string, b: string): number {
	const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
	const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
	const n = Math.max(pa.length, pb.length);
	for (let i = 0; i < n; i++) {
		const x = pa[i] ?? 0;
		const y = pb[i] ?? 0;
		if (x < y) return -1;
		if (x > y) return 1;
	}
	return 0;
}

/** Compare semantic versions; returns -1/0/1. Handles 1.10.x + prereleases. */
export function compareVersions(a: string, b: string): number {
	const va = toSemver(a);
	const vb = toSemver(b);
	if (va && vb) return compare(va, vb);
	return compareNaive(a, b);
}

/** Major version mismatch => UPGRADE_REQUIRED. */
export function needsUpgrade(cliVersion: string, minVersion: string): boolean {
	const vc = toSemver(cliVersion);
	const vm = toSemver(minVersion);
	if (vc && vm) {
		try {
			return lt(vc, vm);
		} catch {
			// fall through to naive fallback
		}
	}
	return compareVersions(cliVersion, minVersion) < 0;
}
