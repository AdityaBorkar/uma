import { oc } from "@orpc/contract";

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
} from "../api-schemas.ts";
import {
	DeviceCodeRequestSchema,
	DeviceCodeResponseSchema,
	DeviceTokenRequestSchema,
	DeviceTokenResponseSchema,
	TaskClaimRequestSchema,
} from "../orpc.ts";

// HTTP/oRPC API contract (contract-first, no implementation).
// Schemas live in `../api-schemas.ts` / `../orpc.ts`; this file only wires
// them into `oc` procedures. Implement with `implement(apiContract)` from
// `@orpc/server`. Transport today: `POST /api/rpc/*` (web) plus the
// device/claim HTTPS endpoints consumed by the machine agent.

const tasksContract = {
	create: oc.input(TaskCreateInputSchema).output(DbRecordSchema),
	get: oc.input(IdInputSchema).errors({ NOT_FOUND: {} }).output(DbRecordSchema),
	list: oc.input(TaskListInputSchema).output(PageOutputSchema),
	stats: oc.input(StatsInputSchema).output(TaskStatsOutputSchema),
	updateStatus: oc
		.input(TaskUpdateStatusInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
};

const signalsContract = {
	create: oc.input(SignalCreateInputSchema).output(DbRecordSchema),
	get: oc.input(IdInputSchema).errors({ NOT_FOUND: {} }).output(DbRecordSchema),
	list: oc.input(SignalListInputSchema).output(PageOutputSchema),
	stats: oc.input(StatsInputSchema).output(SignalStatsOutputSchema),
	update: oc
		.input(SignalUpdateInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
};

const projectsContract = {
	create: oc.input(ProjectCreateInputSchema).output(DbRecordSchema),
	get: oc.input(IdInputSchema).errors({ NOT_FOUND: {} }).output(DbRecordSchema),
	getBySlug: oc
		.input(ProjectGetBySlugInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
	list: oc.input(ProjectListInputSchema).output(PageOutputSchema),
	update: oc
		.input(ProjectUpdateInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
};

const documentsContract = {
	close: oc
		.input(DocumentNumberInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
	comments: {
		create: oc.input(CommentCreateInputSchema).output(DbRecordSchema),
	},
	create: oc.input(DocumentCreateInputSchema).output(DbRecordSchema),
	get: oc
		.input(DocumentNumberInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
	list: oc.input(DocumentListInputSchema).output(PageOutputSchema),
	remove: oc
		.input(DocumentNumberInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(RemoveOutputSchema),
	reopen: oc
		.input(DocumentNumberInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
	update: oc
		.input(DocumentUpdateInputSchema)
		.errors({ NOT_FOUND: {} })
		.output(DbRecordSchema),
};

const connectionsContract = {
	disconnect: oc
		.input(ConnectionDisconnectInputSchema)
		.output(DisconnectOutputSchema),
	get: oc.input(ConnectionGetInputSchema).output(DbRecordSchema.nullable()),
	getAuthUrl: oc
		.input(ConnectionGetAuthUrlInputSchema)
		.output(ConnectionAuthUrlOutputSchema),
	list: oc.output(DbRecordSchema.array()),
	providers: oc.output(ConnectionProvidersOutputSchema),
};

// Machine enrollment + claim over plain HTTPS (device flow is OAuth-style,
// not an oRPC envelope — modeled here so clients share one router shape).
const deviceContract = {
	code: oc.input(DeviceCodeRequestSchema).output(DeviceCodeResponseSchema),
	token: oc
		.input(DeviceTokenRequestSchema)
		.errors({
			ACCESS_DENIED: {},
			AUTHORIZATION_PENDING: {},
			EXPIRED_TOKEN: {},
			SLOW_DOWN: {},
		})
		.output(DeviceTokenResponseSchema),
};

const machinesContract = {
	checkState: oc.output(CheckStateResponseSchema),
	claim: oc
		.input(TaskClaimRequestSchema)
		.errors({ CONFLICT: {} })
		.output(TaskClaimResponseSchema),
	heartbeatHistory: oc.output(HeartbeatHistoryResponseSchema),
	latestVersion: oc.output(LatestVersionResponseSchema),
	resetState: oc
		.input(ResetStateRequestSchema)
		.output(ResetStateResponseSchema),
	sandboxList: oc.output(SandboxListResponseSchema),
};

export const apiContract = {
	connections: connectionsContract,
	device: deviceContract,
	documents: documentsContract,
	machines: machinesContract,
	projects: projectsContract,
	signals: signalsContract,
	tasks: tasksContract,
};
export type ApiContract = typeof apiContract;
