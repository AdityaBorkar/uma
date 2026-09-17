import { z } from "zod";

import { PROJECT_SLUG_MAX, PROJECT_SLUG_MIN } from "../lib/slug.ts";
import { GITHUB_REPO_FULL_NAME_RE, pageInput } from "./shared.ts";

// Closed-set vocabulary lives here as `as const` tuples: Zod enums and
// Postgres enums (`src/db/projects.ts`) derive from these, so adding a value
// is a one-file edit.
export const PROJECT_STATUS_VALUES = [
	"active",
	"on_hold",
	"completed",
] as const;
export const ProjectStatusEnum = z.enum(PROJECT_STATUS_VALUES);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ProjectSchema = z.object({
	createdAt: z.date(),
	createdBy: z.string(),
	description: z.string().max(5000).optional().nullable(),
	githubRepoFullName: z.string().optional().nullable(),
	githubRepoId: z.string().optional().nullable(),
	githubRepoUrl: z.string().optional().nullable(),
	id: z.string(),
	name: z.string().min(2).max(100),
	slug: z
		.string()
		.min(PROJECT_SLUG_MIN)
		.max(PROJECT_SLUG_MAX)
		.regex(PROJECT_SLUG_RE),
	status: ProjectStatusEnum.default("active"),
	updatedAt: z.date(),
});

export const ProjectCreateInput = z.object({
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

export const ProjectUpdateInput = ProjectCreateInput.partial().extend({
	id: z.string(),
	slug: z
		.string()
		.min(PROJECT_SLUG_MIN)
		.max(PROJECT_SLUG_MAX)
		.regex(PROJECT_SLUG_RE)
		.optional(),
});

export const ProjectGetBySlugInput = z.object({
	slug: z.string().min(PROJECT_SLUG_MIN).max(PROJECT_SLUG_MAX),
});

export const ProjectListInput = pageInput({
	status: ProjectStatusEnum.optional(),
});
