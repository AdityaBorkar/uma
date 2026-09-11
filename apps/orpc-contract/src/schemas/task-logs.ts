import { z } from "zod";

// Browser-readable task logs. Machines append via the WS `log` frame
// (`machine-frames.ts`); browsers read pages here. Ownership is checked
// through the parent task (`task.userId`).

export const TaskLogsListInputSchema = z.object({
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(50),
	taskId: z.string().min(1),
});
export type TaskLogsListInput = z.infer<typeof TaskLogsListInputSchema>;
