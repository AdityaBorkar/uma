import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";

import {
	DeviceApproveInputSchema,
	DeviceApproveResponseSchema,
	DeviceCodeRequestSchema,
	DeviceCodeResponseSchema,
	DeviceTokenRequestSchema,
	DeviceTokenResponseSchema,
	TaskClaimRequestSchema,
} from "../schemas/device.ts";
import {
	AgentCreateInputSchema,
	AgentListInputSchema,
	AgentSchema,
	AgentUpdateInputSchema,
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
	MachineGetInputSchema,
	MachineHeartbeatListInputSchema,
	MachineRevokeInputSchema,
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
	TaskLogsListInputSchema,
	TaskRunListInputSchema,
	TaskRunPageOutputSchema,
	TaskRunSchema,
	TaskRunStatsInputSchema,
	TaskRunStatsOutputSchema,
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
//   `{slug}`, `{number}`, `{documentNumber}`, `{machineId}`, `{taskId}`) —
//   required by oRPC compact input mapping. Numeric params (`{number}`,
//   `?limit=`) arrive as strings over HTTP; the server must enable
//   `SmartCoercionHandlerPlugin` (with `ZodToJsonSchemaConverter`) so they
//   coerce to numbers.
// - Static routes (`/tasks/stats`, `/runs/stats`, `/connections/providers`)
//   take precedence over dynamic siblings (`/tasks/{id}`, `/runs/{id}`,
//   `/connections/{provider}`) in the OpenAPI handler; values never collide
//   in practice (UUIDs vs literals, `github|google` vs `providers`).

export const apiContract = {
	agents: {
		create: oc
			.meta(
				openapi({
					description: "Register a custom coding agent for the current user.",
					method: "POST",
					path: "/agents",
					successStatus: 201,
					summary: "Create agent",
					tags: ["agents"],
				}),
			)
			.input(AgentCreateInputSchema)
			.output(AgentSchema)
			.errors({ CONFLICT: {} }),
		get: oc
			.meta(
				openapi({
					description: "Get a registered agent by id.",
					method: "GET",
					path: "/agents/{id}",
					summary: "Get agent",
					tags: ["agents"],
				}),
			)
			.input(IdInputSchema)
			.output(AgentSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List coding agents for the current user. Well-known agents (opencode, pi, omp) are seeded on first call.",
					method: "GET",
					path: "/agents",
					summary: "List agents",
					tags: ["agents"],
				}),
			)
			.input(AgentListInputSchema)
			.output(AgentSchema.array()),
		remove: oc
			.meta(
				openapi({
					description:
						"Remove a custom agent. Well-known agents (opencode, pi, omp) cannot be removed.",
					method: "DELETE",
					path: "/agents/{id}",
					summary: "Remove agent",
					tags: ["agents"],
				}),
			)
			.input(IdInputSchema)
			.output(RemoveOutputSchema)
			.errors({ BAD_REQUEST: {}, NOT_FOUND: {} }),
		update: oc
			.meta(
				openapi({
					description: "Patch an agent's name, binary, version, or status.",
					method: "PATCH",
					path: "/agents/{id}",
					summary: "Update agent",
					tags: ["agents"],
				}),
			)
			.input(AgentUpdateInputSchema)
			.output(AgentSchema)
			.errors({ CONFLICT: {}, NOT_FOUND: {} }),
	},
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
		approve: oc
			.meta(
				openapi({
					description:
						"Approve or deny a device-code enrollment from the browser. Creates the enrolled machine row on approve.",
					method: "POST",
					path: "/device/approve",
					summary: "Approve device enrollment",
					tags: ["device"],
				}),
			)
			.input(DeviceApproveInputSchema)
			.output(DeviceApproveResponseSchema)
			.errors({ CONFLICT: {}, NOT_FOUND: {} }),
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
		get: oc
			.meta(
				openapi({
					description: "Get a machine of the current user by id (browser).",
					method: "GET",
					path: "/machines/{id}",
					summary: "Get machine",
					tags: ["machines"],
				}),
			)
			.input(MachineGetInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
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
		heartbeatList: oc
			.meta(
				openapi({
					description:
						"List recent heartbeat rows for one of the current user's machines (browser).",
					method: "GET",
					path: "/machines/{machineId}/heartbeats",
					summary: "List machine heartbeats",
					tags: ["machines"],
				}),
			)
			.input(MachineHeartbeatListInputSchema)
			.output(HeartbeatHistoryResponseSchema)
			.errors({ NOT_FOUND: {} }),
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
		list: oc
			.meta(
				openapi({
					description: "List machines of the current user (browser).",
					method: "GET",
					path: "/machines",
					summary: "List machines",
					tags: ["machines"],
				}),
			)
			.output(DbRecordSchema.array()),
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
		revoke: oc
			.meta(
				openapi({
					description:
						"Revoke a machine of the current user. Sessions are invalidated and the status becomes revoked.",
					method: "DELETE",
					path: "/machines/{id}",
					summary: "Revoke machine",
					tags: ["machines"],
				}),
			)
			.input(MachineRevokeInputSchema)
			.output(RemoveOutputSchema)
			.errors({ NOT_FOUND: {} }),
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
	runs: {
		get: oc
			.meta(
				openapi({
					description: "Get a task run by id.",
					method: "GET",
					path: "/runs/{id}",
					summary: "Get run",
					tags: ["runs"],
				}),
			)
			.input(IdInputSchema)
			.output(TaskRunSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc
			.meta(
				openapi({
					description:
						"List task runs with cursor pagination and optional task/machine/status filters.",
					method: "GET",
					path: "/runs",
					summary: "List runs",
					tags: ["runs"],
				}),
			)
			.input(TaskRunListInputSchema)
			.output(TaskRunPageOutputSchema),
		stats: oc
			.meta(
				openapi({
					description:
						"Count runs by status (running/completed/failed/cancelled), optionally scoped to a task or machine.",
					method: "GET",
					path: "/runs/stats",
					summary: "Run stats",
					tags: ["runs"],
				}),
			)
			.input(TaskRunStatsInputSchema)
			.output(TaskRunStatsOutputSchema),
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
						"Create a queued task, optionally linked to a project or signal and pinned to an agent.",
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
		logs: {
			list: oc
				.meta(
					openapi({
						description:
							"List streamed log chunks for a task (browser). Machines append via the WS log frame.",
						method: "GET",
						path: "/tasks/{taskId}/logs",
						summary: "List task logs",
						tags: ["tasks"],
					}),
				)
				.input(TaskLogsListInputSchema)
				.output(PageOutputSchema)
				.errors({ NOT_FOUND: {} }),
		},
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
