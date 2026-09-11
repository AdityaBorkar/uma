import { z } from "zod";

// Coding-agent registry: user-owned catalog of agent binaries that can run
// tasks on the user's machines. Ships with well-known defaults
// (`opencode`, `pi`, `omp`); users add custom entries for their own binaries.
// `tasks.agent` stores the agent *name* (plain text, legacy default `"cli"`)
// so task rows stay valid even when a registry entry is renamed or removed.

/** Well-known agents pre-seeded for every user on first `agents.list`. */
export const KNOWN_AGENT_NAMES = ["opencode", "pi", "omp"] as const;
export type KnownAgentName = (typeof KNOWN_AGENT_NAMES)[number];

export const AGENT_STATUS_VALUES = [
	"available",
	"disabled",
	"deprecated",
] as const;
export const AgentStatusEnum = z.enum(AGENT_STATUS_VALUES);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const AgentNameSchema = z
	.string()
	.min(1, "Must be at least 1 character")
	.max(64, "Max 64 characters")
	.regex(
		/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
		"Lowercase slug (letters, digits, dashes)",
	);
export type AgentName = z.infer<typeof AgentNameSchema>;

/** Stored agent row ( Dates pass through the RPC envelope; see common.ts ). */
export const AgentSchema = z.object({
	binary: z.string().nullable(),
	createdAt: z.date(),
	description: z.string().nullable(),
	id: z.string(),
	name: z.string(),
	status: AgentStatusEnum,
	updatedAt: z.date(),
	userId: z.string(),
	version: z.string().nullable(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentCreateInputSchema = z.object({
	binary: z.string().min(1).max(200).optional(),
	description: z.string().max(500).optional(),
	name: AgentNameSchema,
	version: z.string().max(50).optional(),
});
export type AgentCreateInput = z.infer<typeof AgentCreateInputSchema>;

export const AgentUpdateInputSchema = z.object({
	binary: z.string().min(1).max(200).nullable().optional(),
	description: z.string().max(500).nullable().optional(),
	id: z.string(),
	name: AgentNameSchema.optional(),
	status: AgentStatusEnum.optional(),
	version: z.string().max(50).nullable().optional(),
});
export type AgentUpdateInput = z.infer<typeof AgentUpdateInputSchema>;

export const AgentListInputSchema = z
	.object({
		q: z.string().optional(),
		status: AgentStatusEnum.optional(),
	})
	.optional();
export type AgentListInput = z.infer<typeof AgentListInputSchema>;
