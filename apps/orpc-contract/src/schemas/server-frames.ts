import { z } from "zod";

import { LimitsSchema } from "./primitives.ts";

// Server -> machine frames (payload shapes frozen in v1)

export const AssignFrameSchema = z.object({
	branch: z.string().optional(),
	commit: z.string().optional(),
	freshStart: z.boolean().optional(),
	limits: LimitsSchema.partial().optional(),
	projectId: z.string().nullable(),
	prompt: z.string().min(1),
	repoUrl: z.string().optional().default(""),
	t: z.literal("assign"),
	taskId: z.string().min(1),
});
export type AssignFrame = z.infer<typeof AssignFrameSchema>;

export const CancelFrameSchema = z.object({
	t: z.literal("cancel"),
	taskId: z.string().min(1),
});
export type CancelFrame = z.infer<typeof CancelFrameSchema>;

export const ResetConfigFrameSchema = z.object({
	jobId: z.string().min(1),
	keys: z.union([z.array(z.string().min(1)), z.literal("*")]),
	payload: z
		.object({
			keys: z
				.array(
					z.object({
						key: z.string().min(1),
						provider: z.string().min(1),
					}),
				)
				.optional(),
			limits: LimitsSchema.partial().optional(),
			templates: z.record(z.string(), z.string()).optional(),
		})
		.optional(),
	t: z.literal("reset-config"),
	version: z.string().min(1),
});
export type ResetConfigFrame = z.infer<typeof ResetConfigFrameSchema>;

export const UpgradeRequiredFrameSchema = z.object({
	minVersion: z.string().min(1),
	reason: z.string().optional(),
	t: z.literal("UPGRADE_REQUIRED"),
});
export type UpgradeRequiredFrame = z.infer<typeof UpgradeRequiredFrameSchema>;

export const ServerFrameSchema = z.discriminatedUnion("t", [
	AssignFrameSchema,
	CancelFrameSchema,
	ResetConfigFrameSchema,
	UpgradeRequiredFrameSchema,
]);
export type ServerFrame = z.infer<typeof ServerFrameSchema>;

/** Parse inbound server frame; unknown `t` => null (logged + ignored, never thrown). */
export function parseServerFrame(data: unknown): ServerFrame | null {
	if (typeof data !== "object" || data === null) return null;
	const t = (data as Record<string, unknown>).t;
	if (
		t !== "assign" &&
		t !== "cancel" &&
		t !== "reset-config" &&
		t !== "UPGRADE_REQUIRED"
	) {
		return null;
	}
	const r = ServerFrameSchema.safeParse(data);
	return r.success ? r.data : null;
}
