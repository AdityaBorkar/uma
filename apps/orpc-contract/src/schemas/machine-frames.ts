import { z } from "zod";

import { LOG_FRAME_CAP_BYTES, PROTOCOL_VERSION } from "../constants.ts";
import {
	HostMetricsSchema,
	LimitsSchema,
	QuotaUsageSchema,
	SandboxInfoSchema,
} from "./primitives.ts";

// Machine -> server frames (v1, JSON, all carry machineId + protocol:"v1")

const baseMachineFrame = {
	machineId: z.string().min(1),
	protocol: z.literal(PROTOCOL_VERSION),
};

export const HeartbeatFrameSchema = z.object({
	...baseMachineFrame,
	cliVersion: z.string().min(1),
	configVersion: z.string(),
	metrics: HostMetricsSchema,
	quotaUsage: QuotaUsageSchema,
	sandboxes: z.array(SandboxInfoSchema),
	scopeHint: z.string().nullable(),
	t: z.literal("heartbeat"),
});
export type HeartbeatFrame = z.infer<typeof HeartbeatFrameSchema>;

export const LogFrameSchema = z.object({
	...baseMachineFrame,
	// Cap is UTF-8 bytes on the wire (splitChunks is byte-accurate). Zod
	// .max counts UTF-16 units (always <= byte length), so a byte-length
	// refine alone enforces the cap exactly, including multibyte text.
	chunk: z
		.string()
		.describe(
			"Log chunk text. Capped at 256KB UTF-8 bytes on the wire, measured with TextEncoder (byte length, not UTF-16 string length, so multibyte text is capped exactly).",
		)
		.refine((s) => new TextEncoder().encode(s).length <= LOG_FRAME_CAP_BYTES, {
			message: "chunk exceeds 256KB UTF-8 bytes",
		}),
	stream: z.enum(["stdout", "stderr", "system"]).optional(),
	t: z.literal("log"),
	taskId: z.string().min(1),
});
export type LogFrame = z.infer<typeof LogFrameSchema>;

export const TaskDoneFrameSchema = z.object({
	...baseMachineFrame,
	projectId: z.string().nullable(),
	result: z.string().max(65536).optional(),
	status: z.enum(["completed", "failed"]),
	t: z.literal("task-done"),
	taskId: z.string().min(1),
});
export type TaskDoneFrame = z.infer<typeof TaskDoneFrameSchema>;

export const CheckAckFrameSchema = z.object({
	...baseMachineFrame,
	drift: z.array(
		z.object({
			detail: z.string().optional(),
			drifted: z.boolean(),
			key: z.string(),
		}),
	),
	jobId: z.string().min(1),
	t: z.literal("check-ack"),
});
export type CheckAckFrame = z.infer<typeof CheckAckFrameSchema>;

export const ResetAckFrameSchema = z.object({
	...baseMachineFrame,
	error: z.string().optional(),
	jobId: z.string().min(1),
	key: z.string().min(1),
	ok: z.boolean(),
	t: z.literal("reset-ack"),
});
export type ResetAckFrame = z.infer<typeof ResetAckFrameSchema>;

export const SyncAckFrameSchema = z.object({
	...baseMachineFrame,
	jobId: z.string().min(1),
	receipts: z.array(
		z.object({
			error: z.string().optional(),
			key: z.string(),
			ok: z.boolean(),
		}),
	),
	t: z.literal("sync-ack"),
});
export type SyncAckFrame = z.infer<typeof SyncAckFrameSchema>;

export const ClaimAckFrameSchema = z.object({
	...baseMachineFrame,
	error: z.enum(["QUOTA_EXCEEDED"]).or(z.string()).optional(),
	ok: z.boolean(),
	sandboxId: z.string().min(1),
	t: z.literal("claim-ack"),
	taskId: z.string().min(1),
});
export type ClaimAckFrame = z.infer<typeof ClaimAckFrameSchema>;

export const QuotaExceededFrameSchema = z.object({
	...baseMachineFrame,
	limits: LimitsSchema,
	t: z.literal("quota-exceeded"),
	taskId: z.string().min(1),
	usage: QuotaUsageSchema,
});
export type QuotaExceededFrame = z.infer<typeof QuotaExceededFrameSchema>;

export const MachineFrameSchema = z.discriminatedUnion("t", [
	HeartbeatFrameSchema,
	LogFrameSchema,
	TaskDoneFrameSchema,
	CheckAckFrameSchema,
	ResetAckFrameSchema,
	SyncAckFrameSchema,
	ClaimAckFrameSchema,
	QuotaExceededFrameSchema,
]);
export type MachineFrame = z.infer<typeof MachineFrameSchema>;

/** Validate outbound machine frame (never send unknown). */
export function validateMachineFrame(data: unknown) {
	return MachineFrameSchema.safeParse(data);
}
