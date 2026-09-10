// Frozen v1 protocol — single source of truth lives in ../orpc-contract.
// This module re-exports it for machine-side convenience plus local helpers.
export * from "../orpc-contract/src/index.ts";

import { fromZodError } from "zod-validation-error";

import type {
	ClaimAckFrame,
	Limits,
	QuotaExceededFrame,
	QuotaUsage,
} from "../orpc-contract/src/index.ts";
import { validateMachineFrame } from "../orpc-contract/src/index.ts";

/** Validate an outbound machine frame; throws on schema violation (never send unknown). */
export function assertMachineFrame(frame: Record<string, unknown>): void {
	const r = validateMachineFrame(frame);
	if (!r.success) {
		throw new Error(`invalid machine frame: ${fromZodError(r.error).message}`);
	}
}

export interface QuotaRefusalArgs {
	limits: Limits;
	machineId: string;
	/**
	 * ClaimAckFrameSchema requires min(1); quota refusal happens before a
	 * sandbox exists, so callers pass the name that would have been used.
	 */
	sandboxId: string;
	taskId: string;
	usage: QuotaUsage;
}

/** The two refusal frames for one over-quota assign (quota-exceeded + claim-ack). */
export function quotaRefusalFrames(
	args: QuotaRefusalArgs,
): [QuotaExceededFrame, ClaimAckFrame] {
	return [
		{
			limits: args.limits,
			machineId: args.machineId,
			protocol: "v1",
			t: "quota-exceeded",
			taskId: args.taskId,
			usage: args.usage,
		},
		{
			error: "QUOTA_EXCEEDED",
			machineId: args.machineId,
			ok: false,
			protocol: "v1",
			sandboxId: args.sandboxId,
			t: "claim-ack",
			taskId: args.taskId,
		},
	];
}
