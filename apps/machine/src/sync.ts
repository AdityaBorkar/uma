import { nanoid } from "nanoid";

import { type ResetOptions, resetAll } from "./config/mod.ts";
import { stateDbPath } from "./env.ts";
import { persistReceiptsBestEffort } from "./utils/db.ts";

export interface SyncOptions extends ResetOptions {
	jobId?: string;
	only?: string[];
}

/**
 * Perform Sync = full machine state sync (check-all + reset-all in §7 order
 * + per-key receipts + sync-ack shape). Never touches worktrees except
 * --fresh-start for an explicit sandbox (handled by git-binding, not here).
 */
export async function performSync(opts?: SyncOptions) {
	const jobId = opts?.jobId ?? `local-${Date.now()}-${nanoid(6)}`;
	const receipts = await resetAll({
		dryRun: opts?.dryRun,
		only: opts?.only,
		payload: opts?.payload,
		prune: false,
	});
	if (opts?.dryRun) return { jobId, receipts }; // preview only: no receipt rows
	// Persist receipts to SQLite (single-writer: daemon or CLI).
	persistReceiptsBestEffort(stateDbPath(), jobId, receipts);
	return { jobId, receipts };
}

export function syncExitCode(receipts: { ok: boolean }[]): number {
	return receipts.every((r) => r.ok) ? 0 : 2;
}
