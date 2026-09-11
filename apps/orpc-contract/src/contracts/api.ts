import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";

import {
	DeviceCodeRequestSchema,
	DeviceCodeResponseSchema,
	DeviceTokenRequestSchema,
	DeviceTokenResponseSchema,
	TaskClaimRequestSchema,
} from "../schemas/device.ts";
import {
	CheckStateResponseSchema,
	CommentCreateInputSchema,
	ConnectionAuthUrlOutputSchema,
	ConnectionDisconnectInputSchema,
	ConnectionGetAuthUrlInputSchema,
	ConnectionGetInputSchema,
	ConnectionProvidersOutputSchema,
	DbRecordSchema,
	DisconnectOutputSchema,
	DocumentCreateInputSchema,
	DocumentListInputSchema,
	DocumentNumberInputSchema,
	DocumentUpdateInputSchema,
	HeartbeatHistoryResponseSchema,
	IdInputSchema,
	LatestVersionResponseSchema,
	PageOutputSchema,
	ProjectCreateInputSchema,
	ProjectGetBySlugInputSchema,
	ProjectListInputSchema,
	ProjectUpdateInputSchema,
	RemoveOutputSchema,
	ResetStateRequestSchema,
	ResetStateResponseSchema,
	SandboxListResponseSchema,
	SignalCreateInputSchema,
	SignalListInputSchema,
	SignalStatsOutputSchema,
	SignalUpdateInputSchema,
	StatsInputSchema,
	TaskClaimResponseSchema,
	TaskCreateInputSchema,
	TaskListInputSchema,
	TaskStatsOutputSchema,
	TaskUpdateStatusInputSchema,
} from "../schemas/index.ts";

// REST-like HTTP mapping for the oRPC contract.
//
// Every procedure carries `openapi({ method, path, ... })` metadata so the
// same contract serves both transports:
//
// - RPC: `RPCHandler` at `/api/rpc` (existing behavior, unchanged).
// - REST/OpenAPI: `OpenAPIHandler` + generated OpenAPI spec. Method + path
//   below are the canonical REST endpoints; `tags` group by resource.
//
// Conventions:
// - CRUD resources use nouns + standard verbs:
//   `GET /<resources>` (list), `POST /<resources>` (create, 201),
//   `GET /<resources>/{id}` (get), `PATCH /<resources>/{id}` (update),
//   `DELETE /<resources>/{id}` (remove).
// - Sub-resources / actions use verb suffixes:
//   `GET /tasks/stats`, `PATCH /tasks/{id}/status`,
//   `POST /documents/{number}/close`, `DELETE /connections/{provider}`.
// - Machine/device operations are actions, not CRUD, so their paths mirror
//   the procedure name (`POST /machines/claim`, `POST /device/code`).
// - Path-param names match input-schema keys (`{id}`, `{provider}`,
//   `{slug}`, `{number}`, `{documentNumber}`) — required by oRPC compact
//   input mapping. Numeric params (`{number}`, `?limit=`) arrive as strings
//   over HTTP; the server must enable `SmartCoercionHandlerPlugin` (with
//   `ZodToJsonSchemaConverter`) so they coerce to numbers.
// - Static routes (`/tasks/stats`, `/connections/providers`) take precedence
//   over dynamic siblings (`/tasks/{id}`, `/connections/{provider}`) in the
//   OpenAPI handler; values never collide in practice (UUIDs vs literals,
//   `github|google` vs `providers`).

export const apiContract = {
	connections: {
		disconnect: oc
			.meta(
				openapi({
					description: "Disconnect an OAuth provider for the current user.",
					method: "DELETE",
					path: "/connections/{provider}",
					summary: "Disconnect provider",
					tags: ["connections"],
				}),
			)
			.input(ConnectionDisconnectInputSchema)
			.output(DisconnectOutputSchema),
		get: oc
			.meta(
				openapi({
					description: "Get the stored connection for one provider, if any.",
					method: "GET",
					path: "/connections/{provider}",
					summary: "Get connection",
					tags: ["connections"],
				}),
			)
			.input(ConnectionGetInputSchema)
			.output(DbRecordSchema.nullable()),
		getAuthUrl: oc
			.meta(
				openapi({
					description:
						"Get the OAuth authorize URL (plus redirect URI and state) to start a connect flow.",
					method: "GET",
					path: "/connections/{provider}/auth-url",
					summary: "Get provider auth URL",
					tags: ["connections"],
				}),
			)
			.input(ConnectionGetAuthUrlInputSchema)
			.output(ConnectionAuthUrlOutputSchema),
		list: oc
			.meta(
				openapi({
					description: "List stored connections for the current user.",
					method: "GET",
					path: "/connections",
					summary: "List connections",
					tags: ["connections"],
				}),
			)
			.output(DbRecordSchema.array()),
		providers: oc
			.meta(
				openapi({
					description: "List OAuth providers available for connect.",
					method: "GET",
					path: "/connections/providers",
					summary: "List providers",
					tags: ["connections"],
				}),
			)
			.output(ConnectionProvidersOutputSchema),
	},
	device: {
		code: oc
			.meta(
				openapi({
					description:
						"Start the device-code enrollment flow. Returns the device code, user code, and verification URIs.",
					method: "POST",
					path: "/device/code",
					summary: "Start device enrollment",
					tags: ["device"],
				}),
			)
			.input(DeviceCodeRequestSchema)
			.output(DeviceCodeResponseSchema),
		token: oc
			.meta(
				openapi({
					description:
						"Poll for the device-flow access token. Pending/expired/denied states surface as typed errors.",
					method: "POST",
					path: "/device/token",
					summary: "Poll device token",
					tags: ["device"],
				}),
			)
			.input(DeviceTokenRequestSchema)
			.output(DeviceTokenResponseSchema)
			.errors({
				ACCESS_DENIED: {},
				AUTHORIZATION_PENDING: {},
				EXPIRED_TOKEN: {},
				SLOW_DOWN: {},
			}),
	},
	documents: {
		close: oc
			.meta(
				openapi({
					description: "Transition an open document to closed state.",
					method: "POST",
					path: "/documents/{number}/close",
					summary: "Close document",
					tags: ["documents"],
				}),
			)
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		comments: {
			create: oc
				.meta(
					openapi({
						description: "Add a comment to a document.",
						method: "POST",
						path: "/documents/{documentNumber}/comments",
						successStatus: 201,
						summary: "Create comment",
						tags: ["documents"],
					}),
				)
				.input(CommentCreateInputSchema)
				.output(DbRecordSchema),
		},
		create: oc
			.meta(
				openapi({
					description: "Create a document in a project.",
					method: "POST",
					path: "/documents",
					successStatus: 201,
					summary: "Create document",
					tags: ["documents"],
				}),
			)
			.input(DocumentCreateInputSchema)
			.output(DbRecordSchema),
		get: oc
			.meta(
				openapi({
					description: "Get a document by its per-user number.",
					method: "GET",
					path: "/documents/{number}",
					summary: "Get document",
					tags: ["documents"],
				}),
			)
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List documents with cursor pagination and kind/state/project filters.",
					method: "GET",
					path: "/documents",
					summary: "List documents",
					tags: ["documents"],
				}),
			)
			.input(DocumentListInputSchema)
			.output(PageOutputSchema),
		remove: oc
			.meta(
				openapi({
					description:
						"Delete a closed document. Open documents must be closed first.",
					method: "DELETE",
					path: "/documents/{number}",
					summary: "Remove document",
					tags: ["documents"],
				}),
			)
			.input(DocumentNumberInputSchema)
			.output(RemoveOutputSchema)
			.errors({ NOT_FOUND: {} }),
		reopen: oc
			.meta(
				openapi({
					description: "Transition a closed document back to open state.",
					method: "POST",
					path: "/documents/{number}/reopen",
					summary: "Reopen document",
					tags: ["documents"],
				}),
			)
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		update: oc
			.meta(
				openapi({
					description: "Patch a document's title, body, labels, or meta.",
					method: "PATCH",
					path: "/documents/{number}",
					summary: "Update document",
					tags: ["documents"],
				}),
			)
			.input(DocumentUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	machines: {
		checkState: oc
			.meta(
				openapi({
					description:
						"Check desired-state convergence for the calling machine. Returns drift entries and the config version.",
					method: "GET",
					path: "/machines/check-state",
					summary: "Check machine state",
					tags: ["machines"],
				}),
			)
			.output(CheckStateResponseSchema),
		claim: oc
			.meta(
				openapi({
					description:
						"Atomically claim a queued task for a sandbox. Fails with CONFLICT when the task is already taken.",
					method: "POST",
					path: "/machines/claim",
					summary: "Claim task",
					tags: ["machines"],
				}),
			)
			.input(TaskClaimRequestSchema)
			.output(TaskClaimResponseSchema)
			.errors({ CONFLICT: {} }),
		heartbeatHistory: oc
			.meta(
				openapi({
					description: "List recent heartbeat rows for the calling machine.",
					method: "GET",
					path: "/machines/heartbeats",
					summary: "List heartbeats",
					tags: ["machines"],
				}),
			)
			.output(HeartbeatHistoryResponseSchema),
		latestVersion: oc
			.meta(
				openapi({
					description:
						"Get the latest and minimum supported agent versions for upgrade gating.",
					method: "GET",
					path: "/machines/versions/latest",
					summary: "Get latest version",
					tags: ["machines"],
				}),
			)
			.output(LatestVersionResponseSchema),
		resetState: oc
			.meta(
				openapi({
					description:
						"Request convergence of config keys toward desired state. Returns the reset job id (async; receipts arrive over WS).",
					method: "POST",
					path: "/machines/reset-state",
					successStatus: 202,
					summary: "Reset machine state",
					tags: ["machines"],
				}),
			)
			.input(ResetStateRequestSchema)
			.output(ResetStateResponseSchema),
		sandboxList: oc
			.meta(
				openapi({
					description: "List sandboxes visible to the calling machine.",
					method: "GET",
					path: "/machines/sandboxes",
					summary: "List sandboxes",
					tags: ["machines"],
				}),
			)
			.output(SandboxListResponseSchema),
	},
	projects: {
		create: oc
			.meta(
				openapi({
					description: "Create a project. A unique slug is assigned.",
					method: "POST",
					path: "/projects",
					successStatus: 201,
					summary: "Create project",
					tags: ["projects"],
				}),
			)
			.input(ProjectCreateInputSchema)
			.output(DbRecordSchema),
		get: oc
			.meta(
				openapi({
					description: "Get a project by id.",
					method: "GET",
					path: "/projects/{id}",
					summary: "Get project",
					tags: ["projects"],
				}),
			)
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		getBySlug: oc
			.meta(
				openapi({
					description: "Get a project by slug.",
					method: "GET",
					path: "/projects/by-slug/{slug}",
					summary: "Get project by slug",
					tags: ["projects"],
				}),
			)
			.input(ProjectGetBySlugInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List projects with cursor pagination and optional status/search filters.",
					method: "GET",
					path: "/projects",
					summary: "List projects",
					tags: ["projects"],
				}),
			)
			.input(ProjectListInputSchema)
			.output(PageOutputSchema),
		update: oc
			.meta(
				openapi({
					description: "Patch a project's name, description, status, or slug.",
					method: "PATCH",
					path: "/projects/{id}",
					summary: "Update project",
					tags: ["projects"],
				}),
			)
			.input(ProjectUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	signals: {
		create: oc
			.meta(
				openapi({
					description: "Create a signal, optionally linked to a project.",
					method: "POST",
					path: "/signals",
					successStatus: 201,
					summary: "Create signal",
					tags: ["signals"],
				}),
			)
			.input(SignalCreateInputSchema)
			.output(DbRecordSchema),
		get: oc
			.meta(
				openapi({
					description: "Get a signal by id.",
					method: "GET",
					path: "/signals/{id}",
					summary: "Get signal",
					tags: ["signals"],
				}),
			)
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List signals with cursor pagination and optional project/severity/status/search filters.",
					method: "GET",
					path: "/signals",
					summary: "List signals",
					tags: ["signals"],
				}),
			)
			.input(SignalListInputSchema)
			.output(PageOutputSchema),
		stats: oc
			.meta(
				openapi({
					description:
						"Count signals by status (new/triaged/dismissed), optionally scoped to a project.",
					method: "GET",
					path: "/signals/stats",
					summary: "Signal stats",
					tags: ["signals"],
				}),
			)
			.input(StatsInputSchema)
			.output(SignalStatsOutputSchema),
		update: oc
			.meta(
				openapi({
					description: "Patch a signal's fields.",
					method: "PATCH",
					path: "/signals/{id}",
					summary: "Update signal",
					tags: ["signals"],
				}),
			)
			.input(SignalUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	tasks: {
		create: oc
			.meta(
				openapi({
					description:
						"Create a queued task, optionally linked to a project or signal.",
					method: "POST",
					path: "/tasks",
					successStatus: 201,
					summary: "Create task",
					tags: ["tasks"],
				}),
			)
			.input(TaskCreateInputSchema)
			.output(DbRecordSchema),
		get: oc
			.meta(
				openapi({
					description: "Get a task by id.",
					method: "GET",
					path: "/tasks/{id}",
					summary: "Get task",
					tags: ["tasks"],
				}),
			)
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List tasks with cursor pagination and optional project/status/search filters.",
					method: "GET",
					path: "/tasks",
					summary: "List tasks",
					tags: ["tasks"],
				}),
			)
			.input(TaskListInputSchema)
			.output(PageOutputSchema),
		stats: oc
			.meta(
				openapi({
					description:
						"Count tasks by status (queued/running/completed/failed/cancelled), optionally scoped to a project.",
					method: "GET",
					path: "/tasks/stats",
					summary: "Task stats",
					tags: ["tasks"],
				}),
			)
			.input(StatsInputSchema)
			.output(TaskStatsOutputSchema),
		updateStatus: oc
			.meta(
				openapi({
					description:
						"Move a task along its status lifecycle (queued → running → completed/failed/cancelled; failed → queued retries).",
					method: "PATCH",
					path: "/tasks/{id}/status",
					summary: "Update task status",
					tags: ["tasks"],
				}),
			)
			.input(TaskUpdateStatusInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
};

export type ApiContract = typeof apiContract;
