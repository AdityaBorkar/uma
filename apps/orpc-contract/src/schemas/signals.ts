import { z } from "zod";

export const SIGNAL_SEVERITY_VALUES = ["info", "warning", "critical"] as const;
export const SignalSeverityEnum = z.enum(SIGNAL_SEVERITY_VALUES);
export type SignalSeverity = z.infer<typeof SignalSeverityEnum>;

export const SIGNAL_STATUS_VALUES = ["new", "triaged", "dismissed"] as const;
export const SignalStatusEnum = z.enum(SIGNAL_STATUS_VALUES);
export type SignalStatus = z.infer<typeof SignalStatusEnum>;

export const SignalCreateInputSchema = z.object({
	body: z.string().max(5000, "Max 5000 characters").optional(),
	projectId: z.string().optional(),
	severity: SignalSeverityEnum.default("info"),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
	url: z.string().max(2000, "Max 2000 characters").optional(),
});
export type SignalCreateInput = z.infer<typeof SignalCreateInputSchema>;

export const SignalUpdateInputSchema = z.strictObject({
	body: z.string().max(5000).optional(),
	id: z.string(),
	projectId: z.string().nullable().optional(),
	severity: SignalSeverityEnum.optional(),
	status: SignalStatusEnum.optional(),
	title: z.string().min(2).max(200).optional(),
	url: z.string().max(2000).nullable().optional(),
});
export type SignalUpdateInput = z.infer<typeof SignalUpdateInputSchema>;

export const SignalListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		severity: SignalSeverityEnum.optional(),
		status: SignalStatusEnum.optional(),
	})
	.optional();
export type SignalListInput = z.infer<typeof SignalListInputSchema>;

export const SignalStatsOutputSchema = z.object({
	dismissed: z.number().int().min(0),
	new: z.number().int().min(0),
	triaged: z.number().int().min(0),
});
export type SignalStatsOutput = z.infer<typeof SignalStatsOutputSchema>;
