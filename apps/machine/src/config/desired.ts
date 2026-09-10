import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { configDir } from "../env.ts";
import { saveJson0600 } from "../fs-utils.ts";

export interface DesiredState {
	agents?: { bins: string[] };
	limits?: { maxRunning?: number; maxTotal?: number };
	mcp?: { servers: string[] };
	programs?: { bins: string[]; msbVersion?: string };
	providers?: { providers: { provider: string; fingerprint: string }[] };
	skills?: { files: string[] };
	templates?: Record<string, string>;
	version: string;
}

const DEFAULT_DESIRED: DesiredState = {
	agents: { bins: [] },
	mcp: { servers: [] },
	programs: { bins: ["git", "gh", "bun"] },
	providers: { providers: [] },
	skills: { files: [] },
	templates: {},
	version: "v1",
};

export function desiredPath(): string {
	return join(configDir(), "desired.json");
}

export const DesiredStateSchema = z.object({
	agents: z.object({ bins: z.array(z.string()) }).catch({ bins: [] }),
	limits: z
		.object({
			maxRunning: z.number().finite().optional().catch(undefined),
			maxTotal: z.number().finite().optional().catch(undefined),
		})
		.optional()
		.catch(undefined),
	mcp: z.object({ servers: z.array(z.string()) }).catch({ servers: [] }),
	programs: z
		.object({
			bins: z.array(z.string()),
			msbVersion: z.string().optional().catch(undefined),
		})
		.catch({ bins: ["git", "gh", "bun"] }),
	providers: z
		.object({
			providers: z.array(
				z.object({ fingerprint: z.string(), provider: z.string() }),
			),
		})
		.catch({ providers: [] }),
	skills: z.object({ files: z.array(z.string()) }).catch({ files: [] }),
	templates: z.record(z.string(), z.string()).catch({}),
	version: z.string().catch("v1"),
});

export interface DesiredLoadResult {
	error?: string;
	state: DesiredState;
	status: "ok" | "missing" | "corrupt";
}

/** Parse untrusted desired.json, distinguishing missing from corrupt. */
export function loadDesiredResult(): DesiredLoadResult {
	const p = desiredPath();
	if (!existsSync(p))
		return { state: { ...DEFAULT_DESIRED }, status: "missing" };
	try {
		const raw = readFileSync(p, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		const result = DesiredStateSchema.safeParse(parsed);
		if (!result.success) {
			return {
				error: result.error.issues[0]?.message ?? "schema mismatch",
				state: { ...DEFAULT_DESIRED },
				status: "corrupt",
			};
		}
		const data = result.data;
		const out: DesiredState = {
			agents: data.agents,
			mcp: data.mcp,
			programs: data.programs,
			providers: data.providers,
			skills: data.skills,
			templates: data.templates,
			version: data.version,
		};
		if (
			data.limits &&
			(data.limits.maxRunning !== undefined ||
				data.limits.maxTotal !== undefined)
		) {
			out.limits = data.limits;
		}
		return { state: { ...DEFAULT_DESIRED, ...out }, status: "ok" };
	} catch (e) {
		return {
			error: e instanceof Error ? e.message : String(e),
			state: { ...DEFAULT_DESIRED },
			status: "corrupt",
		};
	}
}

/** Parse untrusted desired.json defensively; fall back to defaults per-key. */
export function loadDesired(): DesiredState {
	return loadDesiredResult().state;
}

export function saveDesired(d: DesiredState): void {
	saveJson0600(desiredPath(), d);
}

export interface CheckResult {
	detail?: string;
	drifted: boolean;
	key: string;
}

export interface ResetOptions {
	dryRun?: boolean;
	freshStart?: boolean;
	payload?: Record<string, unknown>;
	prune?: boolean;
	sandbox?: string;
}

export interface ResetResult {
	changed?: boolean;
	error?: string;
	key: string;
	ok: boolean;
}

/**
 * Shared dry-run gate for all key modules. Returns a ResetResult when
 * opts.dryRun is set (caller must return it), else null to continue.
 */
export async function maybeDryRun(
	opts: ResetOptions | undefined,
	key: string,
	check: () => Promise<CheckResult>,
	extra?: Partial<ResetResult>,
): Promise<ResetResult | null> {
	if (!opts?.dryRun) return null;
	const c = await check();
	return { changed: c.drifted, key, ok: true, ...extra };
}
