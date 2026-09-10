import { z } from "zod";

import { RESERVED_MACHINE_NAMES } from "../constants.ts";

export const LimitsSchema = z.object({
	cpu: z.number().optional(),
	maxRunning: z.number().int().min(1),
	maxTotal: z.number().int().min(1),
	ram: z.number().optional(),
});
export type Limits = z.infer<typeof LimitsSchema>;

export const QuotaUsageSchema = z.object({
	running: z.number().int().min(0),
	total: z.number().int().min(0),
});
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>;

export const HostMetricsSchema = z.object({
	cpu: z.number().min(0).max(100),
	disk: z.number().min(0).max(100),
	pids: z.array(z.number().int().min(1)),
	ram: z.number().min(0).max(100),
});
export type HostMetrics = z.infer<typeof HostMetricsSchema>;

export const SandboxInfoSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().nullable(),
	status: z.enum(["created", "running", "stopped", "destroyed"]),
	taskId: z.string().nullable(),
});
export type SandboxInfo = z.infer<typeof SandboxInfoSchema>;

export const MachineNameSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "slug-like lowercase")
	.refine((n) => !(RESERVED_MACHINE_NAMES as readonly string[]).includes(n), {
		message: "reserved machine name",
	});

export const ConnectionStatusSchema = z.enum([
	"enrolled",
	"connected",
	"disconnected",
	"revoked",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
