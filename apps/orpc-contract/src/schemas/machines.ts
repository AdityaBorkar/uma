import { z } from "zod";

import { DbRecordSchema } from "./common.ts";

// Machine-facing HTTPS I/O (responses for the request schemas in orpc.ts).

export const TaskClaimResponseSchema = z.object({
	ok: z.boolean(),
	startedAt: z.number().optional(),
});
export type TaskClaimResponse = z.infer<typeof TaskClaimResponseSchema>;

export const LatestVersionResponseSchema = z.object({
	latest: z.string().min(1),
	min: z.string().min(1),
});
export type LatestVersionResponse = z.infer<typeof LatestVersionResponseSchema>;

export const HeartbeatHistoryResponseSchema = z.object({
	heartbeats: z.array(DbRecordSchema),
});
export type HeartbeatHistoryResponse = z.infer<
	typeof HeartbeatHistoryResponseSchema
>;

export const SandboxListResponseSchema = z.object({
	sandboxes: z.array(DbRecordSchema),
});
export type SandboxListResponse = z.infer<typeof SandboxListResponseSchema>;

export const CheckStateResponseSchema = z.object({
	drift: z.array(DbRecordSchema),
	version: z.string(),
});
export type CheckStateResponse = z.infer<typeof CheckStateResponseSchema>;

export const ResetStateRequestSchema = z.object({
	keys: z.union([z.array(z.string().min(1)), z.literal("*")]).optional(),
});
export type ResetStateRequest = z.infer<typeof ResetStateRequestSchema>;

export const ResetStateResponseSchema = z.object({
	jobId: z.string().min(1),
	keys: z.union([z.array(z.string()), z.literal("*")]),
});
export type ResetStateResponse = z.infer<typeof ResetStateResponseSchema>;

// --- Browser-side machine registry (cookie auth; web-only) ---

export const MachineGetInputSchema = z.object({ id: z.string().min(1) });
export type MachineGetInput = z.infer<typeof MachineGetInputSchema>;

export const MachineRevokeInputSchema = z.object({ id: z.string().min(1) });
export type MachineRevokeInput = z.infer<typeof MachineRevokeInputSchema>;

export const MachineHeartbeatListInputSchema = z.object({
	limit: z.number().int().min(1).max(100).default(50),
	machineId: z.string().min(1),
});
export type MachineHeartbeatListInput = z.infer<
	typeof MachineHeartbeatListInputSchema
>;
