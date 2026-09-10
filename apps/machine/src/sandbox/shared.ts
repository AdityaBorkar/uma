import type { SandboxInfo } from "../../orpc-contract/src/index.ts";
import { msbBin } from "../env.ts";
import { runCapture } from "../proc.ts";

/** Canonical runner for `msb ...` (shared timeout/kill shape with runCapture). */
export async function runCli(
	args: string[],
	timeoutMs = 30000,
): Promise<{ code: number; stdout: string; stderr: string }> {
	const r = await runCapture(msbBin(), args, timeoutMs);
	if (!r) throw new Error(`msb spawn failed: ${msbBin()} ${args[0] ?? ""}`);
	return r;
}

// --- label / status normalization (single home for SDK + CLI paths) ---

export function projectIdFromLabels(
	labels: Record<string, string> | undefined,
	fallback: string | null | undefined,
): string | null {
	const v = labels?.["project.id"] ?? fallback ?? null;
	if (v === "global") return null;
	return v;
}

export function taskIdFromLabels(
	labels: Record<string, string> | undefined,
	fallback: string | null | undefined,
): string | null {
	return labels?.["task.id"] ?? fallback ?? null;
}

const KNOWN_STATUSES: Record<string, SandboxInfo["status"]> = {
	created: "created",
	creating: "created",
	destroyed: "destroyed",
	destroying: "destroyed",
	exited: "stopped",
	paused: "stopped",
	running: "running",
	starting: "running",
	stopped: "stopped",
	stopping: "stopped",
};

export function mapStatus(s: string): SandboxInfo["status"] {
	const l = s.toLowerCase().trim();
	const known = KNOWN_STATUSES[l];
	if (known) return known;
	if (l.includes("run")) return "running";
	if (l.includes("stop") || l.includes("exit")) return "stopped";
	if (l.includes("creat")) return "created";
	if (l.includes("destroy")) return "destroyed";
	return "stopped";
}

/** True when a driver error means "already gone" (idempotent remove/stop). */
export function isNotFoundError(e: unknown): boolean {
	return /not found|does not exist|no such/i.test(
		e instanceof Error ? e.message : String(e),
	);
}
