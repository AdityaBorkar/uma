import { z } from "zod";

// Prompt templates (OpenCode-style slash commands `/name`; distinct from
// the `subagents` assistants. Template is the prompt sent to the LLM;
// description/agent/model/subtask are optional overrides).

export const PromptTemplateNameSchema = z
	.string()
	.min(1, "Must be at least 1 character")
	.max(64, "Max 64 characters")
	.regex(
		/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
		"Lowercase slug (letters, digits, dashes)",
	);

export const PromptTemplateCreateInputSchema = z.object({
	agent: z.string().max(64, "Max 64 characters").optional(),
	description: z.string().max(500, "Max 500 characters").optional(),
	model: z.string().max(200, "Max 200 characters").optional(),
	name: PromptTemplateNameSchema,
	subtask: z.boolean().optional(),
	template: z
		.string()
		.min(1, "Template is required")
		.max(20_000, "Max 20000 characters"),
});
export type PromptTemplateCreateInput = z.infer<
	typeof PromptTemplateCreateInputSchema
>;

export const PromptTemplateUpdateInputSchema = z.object({
	agent: z.string().max(64).nullable().optional(),
	description: z.string().max(500).optional(),
	id: z.string(),
	model: z.string().max(200).nullable().optional(),
	name: PromptTemplateNameSchema.optional(),
	subtask: z.boolean().optional(),
	template: z.string().min(1).max(20_000).optional(),
});
export type PromptTemplateUpdateInput = z.infer<
	typeof PromptTemplateUpdateInputSchema
>;

export const PromptTemplateListInputSchema = z
	.object({
		q: z.string().optional(),
	})
	.optional();
export type PromptTemplateListInput = z.infer<
	typeof PromptTemplateListInputSchema
>;
