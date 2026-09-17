import { z } from "zod";

export const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROJECT_SLUG_MAX = 60;
export const PROJECT_SLUG_MIN = 2;

export const PROJECT_STATUS_VALUES = [
	"active",
	"on_hold",
	"completed",
] as const;
export const ProjectStatusEnum = z.enum(PROJECT_STATUS_VALUES);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const GITHUB_REPO_FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const ProjectCreateInputSchema = z.object({
	description: z.string().max(5000, "Max 5000 characters").optional(),
	githubRepoFullName: z
		.string()
		.min(1, "GitHub repository is required")
		.max(200, "Max 200 characters")
		.regex(
			GITHUB_REPO_FULL_NAME_RE,
			"GitHub repository must be in the form owner/repo",
		),
	name: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(100, "Max 100 characters"),
	slug: z
		.string()
		.min(PROJECT_SLUG_MIN)
		.max(PROJECT_SLUG_MAX)
		.regex(PROJECT_SLUG_RE)
		.optional(),
});
export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;

export const ProjectUpdateInputSchema =
	ProjectCreateInputSchema.partial().extend({
		id: z.string(),
		slug: z
			.string()
			.min(PROJECT_SLUG_MIN)
			.max(PROJECT_SLUG_MAX)
			.regex(PROJECT_SLUG_RE)
			.optional(),
	});
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInputSchema>;

export const ProjectGetBySlugInputSchema = z.object({
	slug: z.string().min(PROJECT_SLUG_MIN).max(PROJECT_SLUG_MAX),
});
export type ProjectGetBySlugInput = z.infer<typeof ProjectGetBySlugInputSchema>;

export const ProjectListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		q: z.string().optional(),
		status: ProjectStatusEnum.optional(),
	})
	.optional();
export type ProjectListInput = z.infer<typeof ProjectListInputSchema>;
