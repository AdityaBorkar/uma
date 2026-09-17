import { KNOWN_AGENT_NAMES } from "@uma/orpc-contract";
import { z } from "zod";

import { slugNameSchema } from "./shared.ts";

export { KNOWN_AGENT_NAMES };

export const AGENT_STATUS_VALUES = [
	"available",
	"disabled",
	"deprecated",
] as const;
export const AgentStatusEnum = z.enum(AGENT_STATUS_VALUES);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const AgentNameSchema = slugNameSchema();

export const AgentCreateInput = z.object({
	binary: z.string().min(1).max(200).optional(),
	description: z.string().max(500).optional(),
	name: AgentNameSchema,
	version: z.string().max(50).optional(),
});

export const AgentUpdateInput = z.object({
	binary: z.string().min(1).max(200).nullable().optional(),
	description: z.string().max(500).nullable().optional(),
	id: z.string(),
	name: AgentNameSchema.optional(),
	status: AgentStatusEnum.optional(),
	version: z.string().max(50).nullable().optional(),
});

export const AgentListInput = z
	.object({
		q: z.string().optional(),
		status: AgentStatusEnum.optional(),
	})
	.optional();
