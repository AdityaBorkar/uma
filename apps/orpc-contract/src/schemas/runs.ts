import { z } from "zod";

// Task runs: one row per execution attempt of a task on a machine.
//
// A run is created as a side effect of the atomic task claim
// (`machines.claim` → `queued → running`) and reaches a terminal status when
// the task finishes (`task-done` frame or `tasks.updateStatus`). Browser
// clients only read runs (`list`/`get`/`stats`); writes are owned by the
// claim/finish paths so the run table can never disagree with task status.

export const RUN_STATUS_VALUES = [
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const RunStatusEnum = z.enum(RUN_STATUS_VALUES);
export type RunStatus = z.infer<typeof RunStatusEnum>;

/** Stored run row. */
export const TaskRunSchema = z.object({
	agent: z.string(),
	createdAt: z.date(),
	finishedAt: z.date().nullable(),
	id: z.string(),
	machineId: z.string().nullable(),
	result: z.string().nullable(),
	sandboxId: z.string().nullable(),
	startedAt: z.date().nullable(),
	status: RunStatusEnum,
	taskId: z.string(),
	updatedAt: z.date(),
	userId: z.string(),
});
export type TaskRun = z.infer<typeof TaskRunSchema>;

export const TaskRunListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		machineId: z.string().optional(),
		status: RunStatusEnum.optional(),
		taskId: z.string().optional(),
	})
	.optional();
export type TaskRunListInput = z.infer<typeof TaskRunListInputSchema>;

export const TaskRunPageOutputSchema = z.object({
	items: z.array(TaskRunSchema),
	nextCursor: z.string().nullable(),
});
export type TaskRunPageOutput = z.infer<typeof TaskRunPageOutputSchema>;

export const TaskRunStatsInputSchema = z
	.object({
		machineId: z.string().optional(),
		taskId: z.string().optional(),
	})
	.optional();
export type TaskRunStatsInput = z.infer<typeof TaskRunStatsInputSchema>;

export const TaskRunStatsOutputSchema = z.object({
	cancelled: z.number().int().min(0),
	completed: z.number().int().min(0),
	failed: z.number().int().min(0),
	running: z.number().int().min(0),
});
export type TaskRunStatsOutput = z.infer<typeof TaskRunStatsOutputSchema>;
