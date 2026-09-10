import { z } from "zod";

// API I/O schemas (wire shapes for the oRPC API contract).
// Canonical source for procedure inputs/outputs; `contracts/api.ts` only wires
// these into `oc` procedures. Web domain inputs mirror
// `apps/web/src/schemas/schema.ts` — that file is the implementation-side copy
// until it migrates to import from here.

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

export const ProjectCreateInputSchema = z.object({
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

export const ConnectionProviderEnum = z.enum(["github", "google"]);
export type ConnectionProvider = z.infer<typeof ConnectionProviderEnum>;

export const ConnectionGetAuthUrlInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionGetAuthUrlInput = z.infer<
	typeof ConnectionGetAuthUrlInputSchema
>;

export const ConnectionGetInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionGetInput = z.infer<typeof ConnectionGetInputSchema>;

export const ConnectionDisconnectInputSchema = z.object({
	provider: ConnectionProviderEnum,
});
export type ConnectionDisconnectInput = z.infer<
	typeof ConnectionDisconnectInputSchema
>;

export const SIGNAL_SEVERITY_VALUES = ["info", "warning", "critical"] as const;
export const SignalSeverityEnum = z.enum(SIGNAL_SEVERITY_VALUES);
export type SignalSeverity = z.infer<typeof SignalSeverityEnum>;

export const SIGNAL_STATUS_VALUES = ["new", "triaged", "dismissed"] as const;
export const SignalStatusEnum = z.enum(SIGNAL_STATUS_VALUES);
export type SignalStatus = z.infer<typeof SignalStatusEnum>;

export const SignalCreateInputSchema = z.object({
	body: z.string().max(5000, "Max 5000 characters").optional(),
	projectId: z.string().optional(),
	severity: SignalSeverityEnum.default("info"),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
	url: z.string().max(2000, "Max 2000 characters").optional(),
});
export type SignalCreateInput = z.infer<typeof SignalCreateInputSchema>;

export const SignalUpdateInputSchema = z.strictObject({
	body: z.string().max(5000).optional(),
	id: z.string(),
	projectId: z.string().nullable().optional(),
	severity: SignalSeverityEnum.optional(),
	status: SignalStatusEnum.optional(),
	title: z.string().min(2).max(200).optional(),
	url: z.string().max(2000).nullable().optional(),
});
export type SignalUpdateInput = z.infer<typeof SignalUpdateInputSchema>;

export const SignalListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		severity: SignalSeverityEnum.optional(),
		status: SignalStatusEnum.optional(),
	})
	.optional();
export type SignalListInput = z.infer<typeof SignalListInputSchema>;

export const TASK_STATUS_VALUES = [
	"queued",
	"running",
	"completed",
	"failed",
	"cancelled",
] as const;
export const TaskStatusEnum = z.enum(TASK_STATUS_VALUES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskCreateInputSchema = z.object({
	projectId: z.string().optional(),
	prompt: z.string().max(10_000, "Max 10000 characters").optional(),
	signalId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

export const TaskUpdateStatusInputSchema = z.object({
	id: z.string(),
	status: TaskStatusEnum,
});
export type TaskUpdateStatusInput = z.infer<typeof TaskUpdateStatusInputSchema>;

export const TaskListInputSchema = z
	.object({
		cursor: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(20),
		projectId: z.string().optional(),
		q: z.string().optional(),
		status: TaskStatusEnum.optional(),
	})
	.optional();
export type TaskListInput = z.infer<typeof TaskListInputSchema>;

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

export const DOCUMENT_STATE_VALUES = ["open", "closed"] as const;
export const DocumentStateEnum = z.enum(DOCUMENT_STATE_VALUES);
export type DocumentState = z.infer<typeof DocumentStateEnum>;

const DocumentBridgeInputSchema = z.object({
	body: z.string().min(1).max(200_000),
	kind: DocumentKindEnum,
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	projectId: z.string().optional(),
	title: z
		.string()
		.min(2, "Must be at least 2 characters")
		.max(200, "Max 200 characters"),
});

export const DocumentCreateInputSchema = DocumentBridgeInputSchema.extend({
	projectId: z.string().min(1),
});
export type DocumentCreateInput = z.infer<typeof DocumentCreateInputSchema>;

export const DocumentUpdateInputSchema = z.object({
	body: z.string().min(1).max(200_000).optional(),
	labels: z.array(z.string().min(1).max(50)).max(20).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
	number: z.number().int().positive(),
	title: z.string().min(2).max(200).optional(),
});
export type DocumentUpdateInput = z.infer<typeof DocumentUpdateInputSchema>;

export const DocumentListInputSchema = z
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
export type DocumentListInput = z.infer<typeof DocumentListInputSchema>;

export const DocumentNumberInputSchema = z.object({
	number: z.number().int().positive(),
});
export type DocumentNumberInput = z.infer<typeof DocumentNumberInputSchema>;

export const CommentCreateInputSchema = z.object({
	body: z.string().min(1).max(10_000),
	documentNumber: z.number().int().positive(),
});
export type CommentCreateInput = z.infer<typeof CommentCreateInputSchema>;

// --- Outputs ---
//
// Row outputs are intentionally loose records: procedures return Drizzle rows
// today, so the contract pins the envelope shape (items/nextCursor, stats,
// auth-url) while row contents pass through. Tighten to entity schemas when
// the web app adopts `implement(apiContract)`.

/** Passthrough for a DB row object. */
export const DbRecordSchema = z.record(z.string(), z.unknown());
export type DbRecord = z.infer<typeof DbRecordSchema>;

/** Cursor-page envelope shared by all `list` procedures. */
export const PageOutputSchema = z.object({
	items: z.array(DbRecordSchema),
	nextCursor: z.string().nullable(),
});
export type PageOutput = z.infer<typeof PageOutputSchema>;

export const TaskStatsOutputSchema = z.object({
	cancelled: z.number().int().min(0),
	completed: z.number().int().min(0),
	failed: z.number().int().min(0),
	queued: z.number().int().min(0),
	running: z.number().int().min(0),
});
export type TaskStatsOutput = z.infer<typeof TaskStatsOutputSchema>;

export const SignalStatsOutputSchema = z.object({
	dismissed: z.number().int().min(0),
	new: z.number().int().min(0),
	triaged: z.number().int().min(0),
});
export type SignalStatsOutput = z.infer<typeof SignalStatsOutputSchema>;

export const StatsInputSchema = z
	.object({ projectId: z.string().optional() })
	.optional();
export type StatsInput = z.infer<typeof StatsInputSchema>;

export const IdInputSchema = z.object({ id: z.string() });
export type IdInput = z.infer<typeof IdInputSchema>;

export const ConnectionAuthUrlOutputSchema = z.object({
	redirectUri: z.string(),
	state: z.string(),
	url: z.string(),
});
export type ConnectionAuthUrlOutput = z.infer<
	typeof ConnectionAuthUrlOutputSchema
>;

export const ConnectionProvidersOutputSchema = z.object({
	providers: z.array(z.object({ id: z.string() })),
});
export type ConnectionProvidersOutput = z.infer<
	typeof ConnectionProvidersOutputSchema
>;

export const DisconnectOutputSchema = z.object({ success: z.literal(true) });
export type DisconnectOutput = z.infer<typeof DisconnectOutputSchema>;

export const RemoveOutputSchema = z.object({ ok: z.literal(true) });
export type RemoveOutput = z.infer<typeof RemoveOutputSchema>;

// --- Machine-facing HTTPS I/O (responses for the request schemas in orpc.ts) ---

export const TaskClaimResponseSchema = z.object({
	ok: z.boolean(),
	startedAt: z.number().optional(),
});
export type TaskClaimResponse = z.infer<typeof TaskClaimResponseSchema>;

export const LatestVersionResponseSchema = z.object({
	latest: z.string().min(1),
	min: z.string().min(1),
});
export type LatestVersionResponse = z.infer<typeof LatestVersionResponseSchema>;

export const HeartbeatHistoryResponseSchema = z.object({
	heartbeats: z.array(DbRecordSchema),
});
export type HeartbeatHistoryResponse = z.infer<
	typeof HeartbeatHistoryResponseSchema
>;

export const SandboxListResponseSchema = z.object({
	sandboxes: z.array(DbRecordSchema),
});
export type SandboxListResponse = z.infer<typeof SandboxListResponseSchema>;

export const CheckStateResponseSchema = z.object({
	drift: z.array(DbRecordSchema),
	version: z.string(),
});
export type CheckStateResponse = z.infer<typeof CheckStateResponseSchema>;

export const ResetStateRequestSchema = z.object({
	keys: z.union([z.array(z.string().min(1)), z.literal("*")]).optional(),
});
export type ResetStateRequest = z.infer<typeof ResetStateRequestSchema>;

export const ResetStateResponseSchema = z.object({
	jobId: z.string().min(1),
	keys: z.union([z.array(z.string()), z.literal("*")]),
});
export type ResetStateResponse = z.infer<typeof ResetStateResponseSchema>;

// --- WS channel I/O (unary wrappers; streaming uses `eventIterator`) ---

/** Ack for a machine→server frame delivered over the WS channel. */
export const WsSendAckSchema = z.object({ ok: z.literal(true) });
export type WsSendAck = z.infer<typeof WsSendAckSchema>;

/** Subscribe input for the server→machine stream (resumption via lastEventId). */
export const WsSubscribeInputSchema = z.object({
	lastEventId: z.string().optional(),
	machineId: z.string().min(1),
});
export type WsSubscribeInput = z.infer<typeof WsSubscribeInputSchema>;
