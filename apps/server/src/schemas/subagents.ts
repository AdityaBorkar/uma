import { z } from "zod";

import { pageInput, slugNameSchema } from "./shared.ts";

// --- Subagents (OpenCode-style specialized assistants; distinct from the
// `agents` binary registry above. No built-ins seeded — custom rows only) ---

export const SUBAGENT_PERMISSION_VALUES = ["allow", "ask", "deny"] as const;
export const SubagentPermissionEnum = z.enum(SUBAGENT_PERMISSION_VALUES);
export type SubagentPermission = z.infer<typeof SubagentPermissionEnum>;

export const SUBAGENT_PERMISSION_KEYS = [
	"edit",
	"bash",
	"webfetch",
	"websearch",
	"task",
] as const;

type PermissionKey = (typeof SUBAGENT_PERMISSION_KEYS)[number];

function buildPermissionShape(): Record<
	PermissionKey,
	z.ZodOptional<typeof SubagentPermissionEnum>
> {
	const shape = {} as Record<
		PermissionKey,
		z.ZodOptional<typeof SubagentPermissionEnum>
	>;
	for (const key of SUBAGENT_PERMISSION_KEYS) {
		shape[key] = SubagentPermissionEnum.optional();
	}
	return shape;
}

const permissionShape = buildPermissionShape();

export const SubagentPermissionsSchema = z.object(permissionShape).optional();
export type SubagentPermissions = z.infer<typeof SubagentPermissionsSchema>;

export const SubagentNameSchema = slugNameSchema();

export const SubagentColorSchema = z
	.string()
	.max(32, "Max 32 characters")
	.regex(
		/^(#[0-9a-fA-F]{6}|primary|secondary|accent|success|warning|error|info)$/,
		"Hex (#RRGGBB) or theme color",
	)
	.nullable()
	.optional();

export const SubagentCreateInput = z.object({
	color: SubagentColorSchema,
	description: z
		.string()
		.min(1, "Description is required")
		.max(500, "Max 500 characters"),
	disabled: z.boolean().optional(),
	hidden: z.boolean().optional(),
	model: z.string().max(200, "Max 200 characters").optional(),
	name: SubagentNameSchema,
	permissions: SubagentPermissionsSchema,
	prompt: z
		.string()
		.min(1, "Prompt is required")
		.max(20_000, "Max 20000 characters"),
	steps: z.number().int().min(1).max(500).nullable().optional(),
	temperature: z.number().min(0).max(1).nullable().optional(),
	topP: z.number().min(0).max(1).nullable().optional(),
});
export type SubagentCreateInput = z.infer<typeof SubagentCreateInput>;

export const SubagentUpdateInput = z.object({
	color: SubagentColorSchema,
	description: z.string().min(1).max(500).optional(),
	disabled: z.boolean().optional(),
	hidden: z.boolean().optional(),
	id: z.string(),
	model: z.string().max(200).nullable().optional(),
	name: SubagentNameSchema.optional(),
	permissions: SubagentPermissionsSchema,
	prompt: z.string().min(1).max(20_000).optional(),
	steps: z.number().int().min(1).max(500).nullable().optional(),
	temperature: z.number().min(0).max(1).nullable().optional(),
	topP: z.number().min(0).max(1).nullable().optional(),
});
export type SubagentUpdateInput = z.infer<typeof SubagentUpdateInput>;

export const SubagentListInput = pageInput({});
export type SubagentListInput = z.infer<typeof SubagentListInput>;
