import { z } from "zod";

import { pageInput } from "./shared.ts";

export const TASK_STATUS_VALUES = [
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const TaskStatusEnum = z.enum(TASK_STATUS_VALUES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskCreateInput = z.object({
	agent: z.string().min(1).max(64).optional(),
	projectId: z.string().optional(),
	prompt: z.string().max(10_000, "Max 10000 characters").optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const TaskUpdateStatusInput = z.object({
	id: z.string(),
	status: TaskStatusEnum,
});

export const TaskListInput = pageInput({
	agent: z.string().optional(),
	projectId: z.string().optional(),
	status: TaskStatusEnum.optional(),
});
