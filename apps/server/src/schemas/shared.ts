import { z } from "zod";

/** Shared Zod building blocks for all domain schemas. */

/** Lowercase slug (letters, digits, dashes) shared by agents/subagents/templates. */
export const SLUG_NAME_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function slugNameSchema(): z.ZodString {
	return z
		.string()
		.min(1, "Must be at least 1 character")
		.max(64, "Max 64 characters")
		.regex(SLUG_NAME_RE, "Lowercase slug (letters, digits, dashes)");
}

export const GITHUB_REPO_FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Cursor/limit/search page input shared by every list procedure. */
export function pageInput<Extra extends z.ZodRawShape>(
	extra: Extra,
	defaultLimit = 20,
): z.ZodOptional<
	z.ZodObject<
		Extra & {
			cursor: z.ZodOptional<z.ZodString>;
			limit: z.ZodDefault<z.ZodNumber>;
			q: z.ZodOptional<z.ZodString>;
		}
	>
> {
	return z
		.object({
			cursor: z.string().optional(),
			limit: z.number().int().min(1).max(100).default(defaultLimit),
			q: z.string().optional(),
			...extra,
		})
		.optional();
}
