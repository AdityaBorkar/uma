import { z } from "zod";

export const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROJECT_SLUG_MAX = 60;
export const PROJECT_SLUG_MIN = 2;

// Closed-set vocabulary lives here as `as const` tuples: Zod enums, Postgres
// enums (`src/schemas/db/*`), UI option lists, and client form validation all
// derive from these, so adding a value is a one-file edit.
export const PROJECT_STATUS_VALUES = [
	"active",
	"on_hold",
	"completed",
] as const;
export const ProjectStatusEnum = z.enum(PROJECT_STATUS_VALUES);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const ProjectSchema = z.object({
	createdAt: z.date(),
	createdBy: z.string(),
	description: z.string().max(5000).optional().nullable(),
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
	status: ProjectStatusEnum.default("active"),
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

export const ProjectListInput = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		q: z.string().optional(),
		status: ProjectStatusEnum.optional(),
	})
	.optional();

export const ConnectionProviderEnum = z.enum(["github", "google"]);

export const ConnectionGetAuthUrlInput = z.object({
	provider: ConnectionProviderEnum,
});

export const ConnectionGetInput = z.object({
	provider: ConnectionProviderEnum,
});

export const ConnectionDisconnectInput = z.object({
	provider: ConnectionProviderEnum,
});

// --- Signals & agentic tasks ---

export const SIGNAL_SEVERITY_VALUES = ["info", "warning", "critical"] as const;
export const SignalSeverityEnum = z.enum(SIGNAL_SEVERITY_VALUES);
export type SignalSeverity = z.infer<typeof SignalSeverityEnum>;

export const SIGNAL_STATUS_VALUES = ["new", "triaged", "dismissed"] as const;
export const SignalStatusEnum = z.enum(SIGNAL_STATUS_VALUES);
export type SignalStatus = z.infer<typeof SignalStatusEnum>;

// Lenient url on purpose: manual capture may paste partial refs — no .url().
export const SignalCreateInput = z.object({
	body: z.string().max(5000, "Max 5000 characters").optional(),
	projectId: z.string().optional(),
	severity: SignalSeverityEnum.default("info"),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
	url: z.string().max(2000, "Max 2000 characters").optional(),
});

export const SignalUpdateInput = z.strictObject({
	body: z.string().max(5000).optional(),
	id: z.string(),
	projectId: z.string().nullable().optional(),
	severity: SignalSeverityEnum.optional(),
	status: SignalStatusEnum.optional(),
	title: z.string().min(2).max(200).optional(),
	url: z.string().max(2000).nullable().optional(),
});

export const SignalListInput = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		severity: SignalSeverityEnum.optional(),
		status: SignalStatusEnum.optional(),
	})
	.optional();

export const TASK_STATUS_VALUES = [
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const TaskStatusEnum = z.enum(TASK_STATUS_VALUES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskCreateInput = z.object({
	agent: z.string().min(1).max(64).optional(),
	projectId: z.string().optional(),
	prompt: z.string().max(10_000, "Max 10000 characters").optional(),
	signalId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const TaskUpdateStatusInput = z.object({
	id: z.string(),
	status: TaskStatusEnum,
});

export const TaskListInput = z
	.object({
		agent: z.string().optional(),
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		status: TaskStatusEnum.optional(),
	})
	.optional();

// --- Documents (docs/adr/004-documents-single-primitive.md + docs/CONTEXT.md) ---

export const DOCUMENT_KIND_VALUES = [
	"wiki",
	"spec",
	"bug_report",
	"update",
	"changelog",
	"release",
	"deployment",
	"action_log",
] as const;
export const DocumentKindEnum = z.enum(DOCUMENT_KIND_VALUES);
export type DocumentKind = z.infer<typeof DocumentKindEnum>;

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
	action_log: "Action log",
	bug_report: "Bug report",
	changelog: "Changelog",
	deployment: "Deployment",
	release: "Release",
	spec: "Specification",
	update: "Update",
	wiki: "Wiki",
};

/** UI option list for the kind picker — labels checked exhaustive by type. */
export const DOCUMENT_KINDS = DOCUMENT_KIND_VALUES.map((value) => ({
	label: DOCUMENT_KIND_LABELS[value],
	value,
}));

export function kindLabel(kind: string): string {
	return DOCUMENT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export const DOCUMENT_STATE_VALUES = ["open", "closed"] as const;
export const DocumentStateEnum = z.enum(DOCUMENT_STATE_VALUES);
export type DocumentState = z.infer<typeof DocumentStateEnum>;

// Kind-specific frontmatter extras (ADR 004). Common fields (title, labels,
// projectId) are shared columns; these schemas only govern `meta`.
export function documentMetaSchema(kind: string) {
	const base = z.record(z.string(), z.unknown());
	switch (kind) {
		case "bug_report":
			return z.looseObject({ severity: SignalSeverityEnum.optional() });
		case "deployment":
			return z.looseObject({ environment: z.string().max(100).optional() });
		case "release":
			return z.looseObject({ tagName: z.string().max(100).optional() });
		case "spec":
			return z.looseObject({
				status: z.enum(["draft", "review", "approved"]).optional(),
			});
		default:
			return base;
	}
}

export interface DocumentMetaField {
	label: string;
	name: string;
	options?: string[];
}

/** Explicit per-kind field descriptors — no Zod introspection in the UI. */
export function documentMetaFields(kind: string): DocumentMetaField[] {
	switch (kind) {
		case "bug_report":
			return [
				{
					label: "Severity",
					name: "severity",
					options: [...SIGNAL_SEVERITY_VALUES],
				},
			];
		case "deployment":
			return [{ label: "Environment", name: "environment" }];
		case "release":
			return [{ label: "Tag Name", name: "tagName" }];
		case "spec":
			return [
				{
					label: "Status",
					name: "status",
					options: ["draft", "review", "approved"],
				},
			];
		default:
			return [];
	}
}

const DocumentBridgeInput = z.object({
	body: z.string().min(1).max(200_000),
	// Free-form frontmatter extras; validated against the kind schema.
	kind: DocumentKindEnum,
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	projectId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const DocumentCreateInput = DocumentBridgeInput.extend({
	projectId: z.string().min(1),
});

export const DocumentUpdateInput = z.object({
	body: z.string().min(1).max(200_000).optional(),
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	number: z.number().int().positive(),
	title: z.string().min(2).max(200).optional(),
});

export const DocumentListInput = z
	.object({
		cursor: z.string().optional(),
		kind: DocumentKindEnum.optional(),
		kinds: DocumentKindEnum.array().optional(),
		label: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		state: DocumentStateEnum.optional(),
	})
	.optional();

export const DocumentNumberInput = z.object({
	number: z.number().int().positive(),
});

export const CommentCreateInput = z.object({
	body: z.string().min(1).max(10_000),
	documentNumber: z.number().int().positive(),
});

// --- Coding agents & task runs (mirrors @uma/orpc-contract, which is
// canonical for the wire; this file stays dependency-free for the browser) ---

/** Well-known agents seeded per user on first `agents.list`. */
export const KNOWN_AGENT_NAMES = ["opencode", "pi", "omp"] as const;

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

export const RUN_STATUS_VALUES = [
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const RunStatusEnum = z.enum(RUN_STATUS_VALUES);
export type RunStatus = z.infer<typeof RunStatusEnum>;

export const TaskRunListInput = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		machineId: z.string().optional(),
		status: RunStatusEnum.optional(),
		taskId: z.string().optional(),
	})
	.optional();

export const TaskLogsListInput = z.object({
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(50),
	taskId: z.string().min(1),
});

export const MachineHeartbeatListInput = z.object({
	limit: z.number().int().min(1).max(100).default(50),
	machineId: z.string().min(1),
});

export const DeviceApproveInput = z.object({
	approve: z.boolean().default(true),
	user_code: z.string().min(1),
});
