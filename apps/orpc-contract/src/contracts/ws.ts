import { eventIterator, oc } from "@orpc/contract";

import { MACHINES_WS_PATH, PROTOCOL_VERSION } from "../constants.ts";
import { WsSendAckSchema, WsSubscribeInputSchema } from "../schemas/index.ts";
import {
	CheckAckFrameSchema,
	ClaimAckFrameSchema,
	HeartbeatFrameSchema,
	LogFrameSchema,
	MachineFrameSchema,
	QuotaExceededFrameSchema,
	ResetAckFrameSchema,
	SyncAckFrameSchema,
	TaskDoneFrameSchema,
} from "../schemas/machine-frames.ts";
import {
	AssignFrameSchema,
	CancelFrameSchema,
	ResetConfigFrameSchema,
	ServerFrameSchema,
	UpgradeRequiredFrameSchema,
} from "../schemas/server-frames.ts";

export const wsMessagesContract = {
	machineToServer: {
		"check-ack": CheckAckFrameSchema,
		"claim-ack": ClaimAckFrameSchema,
		heartbeat: HeartbeatFrameSchema,
		log: LogFrameSchema,
		"quota-exceeded": QuotaExceededFrameSchema,
		"reset-ack": ResetAckFrameSchema,
		"sync-ack": SyncAckFrameSchema,
		"task-done": TaskDoneFrameSchema,
	},
	path: MACHINES_WS_PATH,
	protocol: PROTOCOL_VERSION,
	serverToMachine: {
		assign: AssignFrameSchema,
		cancel: CancelFrameSchema,
		"reset-config": ResetConfigFrameSchema,
		UPGRADE_REQUIRED: UpgradeRequiredFrameSchema,
	},
} as const;

export const wsContract = {
	machines: {
		send: oc.input(MachineFrameSchema).output(WsSendAckSchema),
		stream: oc
			.input(WsSubscribeInputSchema)
			.output(eventIterator(ServerFrameSchema)),
	},
};
export type WsContract = typeof wsContract;
