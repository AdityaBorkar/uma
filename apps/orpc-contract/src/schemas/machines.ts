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
