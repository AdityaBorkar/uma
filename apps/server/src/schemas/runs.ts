import { z } from "zod";

import { pageInput } from "./shared.ts";

export const RUN_STATUS_VALUES = [
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const RunStatusEnum = z.enum(RUN_STATUS_VALUES);
export type RunStatus = z.infer<typeof RunStatusEnum>;

export const TaskRunListInput = pageInput({
	machineId: z.string().optional(),
	status: RunStatusEnum.optional(),
	taskId: z.string().optional(),
});

/** Machine execution limits (mirrors the `limits` jsonb column). */
export const LimitsSchema = z.object({
	maxRunning: z.number().int().nonnegative().optional(),
	maxTotal: z.number().int().nonnegative().optional(),
});
export type Limits = z.infer<typeof LimitsSchema>;
