import { eventIterator, oc } from "@orpc/contract";

import { WsSendAckSchema, WsSubscribeInputSchema } from "../api-schemas.ts";
import { MACHINES_WS_PATH, PROTOCOL_VERSION } from "../constants.ts";
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
} from "../machine-frames.ts";
import {
	AssignFrameSchema,
	CancelFrameSchema,
	ResetConfigFrameSchema,
	ServerFrameSchema,
	UpgradeRequiredFrameSchema,
} from "../server-frames.ts";

// WS messages contract (frozen v1).
//
// Transport is raw JSON frames at MACHINES_WS_PATH, NOT an oRPC envelope —
// that wire shape is frozen (see VERSIONING.md), so this file does two things:
//  1. `wsMessagesContract`: the canonical raw-frame registry (path, protocol,
//     per-`t` schemas, discriminated unions). Senders/parsers keep using
//     `validateMachineFrame` / `parseServerFrame` against these schemas.
//  2. `wsContract`: the same channel modeled as `oc` procedures so future
//     oRPC-native clients/servers share types — `machines.send` for
//     machine→server delivery, `machines.stream` (event iterator) for the
//     server→machine stream.

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
