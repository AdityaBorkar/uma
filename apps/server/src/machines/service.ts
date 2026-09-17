/**
 * Machine service facade.
 *
 * New code should import from `./auth.ts`, `./device.ts`, `./heartbeat.ts`,
 * or `./tasks.ts` directly. This module re-exports the split surface plus
 * the small fan-out/health helpers so existing callers keep working.
 */

import { sql } from "drizzle-orm";

import { db } from "../db/client.ts";
import { machines } from "../db/machines.ts";
import { tasks } from "../db/tasks.ts";
import { MIN_CLI_VERSION } from "./config.ts";
import { isMachineConnected, sendToMachine } from "./sockets.ts";

export type { MachineSession } from "./auth.ts";
export { authMachine, bearerToken } from "./auth.ts";
export type { ApproveResult, DeviceCodeRecord, PollResult } from "./device.ts";
export {
	approveDevice,
	createDeviceCode,
	pollDeviceToken,
	revokeMachine,
} from "./device.ts";
export type { HeartbeatInput } from "./heartbeat.ts";
export {
	heartbeatHistory,
	markConnected,
	markDisconnected,
	recordHeartbeat,
	sandboxList,
} from "./heartbeat.ts";
export { appendTaskLog, claimTask, finishTask } from "./tasks.ts";

// --- Server → machine fan-out ---

export interface ResetStateInput {
	keys?: string[] | "*";
	payload?: Record<string, unknown>;
}

export async function resetState(
	machineId: string,
	input: ResetStateInput,
	version = "v1",
): Promise<{ jobId: string; keys: string[] | "*"; sent: boolean }> {
	const jobId = `job_${Date.now()}`;
	const keys = input.keys ?? "*";
	const frame = {
		jobId,
		keys,
		payload: input.payload ?? {},
		t: "reset-config",
		version,
	};
	const sent = sendToMachine(machineId, frame);
	return { jobId, keys, sent };
}

export function machineConnected(machineId: string): boolean {
	return isMachineConnected(machineId);
}

/** Latest-version gate for the daemon upgrade check. */
export function latestVersion(): { latest: string; min: string } {
	return { latest: MIN_CLI_VERSION, min: MIN_CLI_VERSION };
}

/** Total row counts for `/api/machines/health` without leaking contents. */
export async function healthCounts(): Promise<{
	machines: number;
	tasks: number;
}> {
	const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(machines);
	const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(tasks);
	return { machines: m?.n ?? 0, tasks: t?.n ?? 0 };
}
