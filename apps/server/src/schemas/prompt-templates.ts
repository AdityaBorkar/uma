import { z } from "zod";

import { pageInput, slugNameSchema } from "./shared.ts";

// --- Prompt templates (OpenCode-style slash commands `/name`; distinct from
// the `subagents` assistants above. Template is the prompt sent to the LLM;
// description/agent/model/subtask are optional overrides) ---

export const PromptTemplateNameSchema = slugNameSchema();

export const PromptTemplateCreateInput = z.object({
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
	typeof PromptTemplateCreateInput
>;

export const PromptTemplateUpdateInput = z.object({
	agent: z.string().max(64).nullable().optional(),
	description: z.string().max(500).optional(),
	id: z.string(),
	model: z.string().max(200).nullable().optional(),
	name: PromptTemplateNameSchema.optional(),
	subtask: z.boolean().optional(),
	template: z.string().min(1).max(20_000).optional(),
});
export type PromptTemplateUpdateInput = z.infer<
	typeof PromptTemplateUpdateInput
>;

export const PromptTemplateListInput = pageInput({});
export type PromptTemplateListInput = z.infer<typeof PromptTemplateListInput>;
