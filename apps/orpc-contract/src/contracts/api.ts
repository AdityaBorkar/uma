import { oc } from "@orpc/contract";

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

export const apiContract = {
	connections: {
		disconnect: oc
			.input(ConnectionDisconnectInputSchema)
			.output(DisconnectOutputSchema),
		get: oc.input(ConnectionGetInputSchema).output(DbRecordSchema.nullable()),
		getAuthUrl: oc
			.input(ConnectionGetAuthUrlInputSchema)
			.output(ConnectionAuthUrlOutputSchema),
		list: oc.output(DbRecordSchema.array()),
		providers: oc.output(ConnectionProvidersOutputSchema),
	},
	device: {
		code: oc.input(DeviceCodeRequestSchema).output(DeviceCodeResponseSchema),
		token: oc
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
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		comments: {
			create: oc.input(CommentCreateInputSchema).output(DbRecordSchema),
		},
		create: oc.input(DocumentCreateInputSchema).output(DbRecordSchema),
		get: oc
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc.input(DocumentListInputSchema).output(PageOutputSchema),
		remove: oc
			.input(DocumentNumberInputSchema)
			.output(RemoveOutputSchema)
			.errors({ NOT_FOUND: {} }),
		reopen: oc
			.input(DocumentNumberInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		update: oc
			.input(DocumentUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	machines: {
		checkState: oc.output(CheckStateResponseSchema),
		claim: oc
			.input(TaskClaimRequestSchema)
			.output(TaskClaimResponseSchema)
			.errors({ CONFLICT: {} }),
		heartbeatHistory: oc.output(HeartbeatHistoryResponseSchema),
		latestVersion: oc.output(LatestVersionResponseSchema),
		resetState: oc
			.input(ResetStateRequestSchema)
			.output(ResetStateResponseSchema),
		sandboxList: oc.output(SandboxListResponseSchema),
	},
	projects: {
		create: oc.input(ProjectCreateInputSchema).output(DbRecordSchema),
		get: oc
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		getBySlug: oc
			.input(ProjectGetBySlugInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc.input(ProjectListInputSchema).output(PageOutputSchema),
		update: oc
			.input(ProjectUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	signals: {
		create: oc.input(SignalCreateInputSchema).output(DbRecordSchema),
		get: oc
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc.input(SignalListInputSchema).output(PageOutputSchema),
		stats: oc.input(StatsInputSchema).output(SignalStatsOutputSchema),
		update: oc
			.input(SignalUpdateInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
	tasks: {
		create: oc.input(TaskCreateInputSchema).output(DbRecordSchema),
		get: oc
			.input(IdInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
		list: oc.input(TaskListInputSchema).output(PageOutputSchema),
		stats: oc.input(StatsInputSchema).output(TaskStatsOutputSchema),
		updateStatus: oc
			.input(TaskUpdateStatusInputSchema)
			.output(DbRecordSchema)
			.errors({ NOT_FOUND: {} }),
	},
};

export type ApiContract = typeof apiContract;
