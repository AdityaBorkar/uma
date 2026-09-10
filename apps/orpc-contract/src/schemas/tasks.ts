import { z } from "zod";

export const TASK_STATUS_VALUES = [
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const TaskStatusEnum = z.enum(TASK_STATUS_VALUES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskCreateInputSchema = z.object({
	projectId: z.string().optional(),
	prompt: z.string().max(10_000, "Max 10000 characters").optional(),
	signalId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

export const TaskUpdateStatusInputSchema = z.object({
	id: z.string(),
	status: TaskStatusEnum,
});
export type TaskUpdateStatusInput = z.infer<typeof TaskUpdateStatusInputSchema>;

export const TaskListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		status: TaskStatusEnum.optional(),
	})
	.optional();
export type TaskListInput = z.infer<typeof TaskListInputSchema>;

export const TaskStatsOutputSchema = z.object({
	cancelled: z.number().int().min(0),
	completed: z.number().int().min(0),
	failed: z.number().int().min(0),
	queued: z.number().int().min(0),
	running: z.number().int().min(0),
});
export type TaskStatsOutput = z.infer<typeof TaskStatsOutputSchema>;
