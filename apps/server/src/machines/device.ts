import {
	deviceCode,
	MachineNameSchema,
	sessionToken,
	userCode,
} from "@uma/orpc-contract";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../db/client.ts";
import { deviceCodes, machineSessions, machines } from "../db/machines.ts";
import { publicWebUrl } from "../env.ts";
import {
	allowedClients,
	DEVICE_CODE_TTL_S,
	DEVICE_POLL_INTERVAL_S,
} from "./config.ts";

export interface DeviceCodeRecord {
	device_code: string;
	expires_in: number;
	interval: number;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
}

export async function createDeviceCode(
	clientId: string,
	machineName?: string,
): Promise<
	| { ok: true; record: DeviceCodeRecord }
	| { ok: false; error: "invalid_client" | "invalid_name"; detail?: string }
> {
	if (!allowedClients().includes(clientId)) {
		return { error: "invalid_client", ok: false };
	}
	if (machineName !== undefined) {
		const v = MachineNameSchema.safeParse(machineName);
		if (!v.success) {
			return {
				detail: v.error.issues[0]?.message ?? "invalid machine name",
				error: "invalid_name",
				ok: false,
			};
		}
	}
	const machineId = crypto.randomUUID();
	const userCodeValue = userCode();
	const verificationUri = new URL("/device", publicWebUrl);
	const completeUri = new URL("/device", publicWebUrl);
	completeUri.searchParams.set("code", userCodeValue);
	const record: DeviceCodeRecord = {
		device_code: deviceCode(),
		expires_in: DEVICE_CODE_TTL_S,
		interval: DEVICE_POLL_INTERVAL_S,
		user_code: userCodeValue,
		verification_uri: verificationUri.toString(),
		verification_uri_complete: completeUri.toString(),
	};
	await db.insert(deviceCodes).values({
		clientId,
		deviceCode: record.device_code,
		expiresIn: record.expires_in,
		interval: record.interval,
		machineId,
		machineName: machineName ?? null,
		status: "pending",
		userCode: record.user_code,
	});
	return { ok: true, record };
}

export type ApproveResult = "ok" | "unknown" | "duplicate" | "denied";

/**
 * Approve (or deny) a device code as `userId`. Approval pre-creates the
 * enrolled machine; `UNIQUE(userId, name)` violations deny the grant so the
 * poller observes `access_denied`.
 */
export async function approveDevice(
	userId: string,
	code: string,
	approve: boolean,
): Promise<ApproveResult> {
	return db.transaction(async (tx) => {
		const [rec] = await tx
			.select()
			.from(deviceCodes)
			.where(eq(deviceCodes.userCode, code))
			.limit(1);
		if (!rec) return "unknown" as ApproveResult;
		// Idempotent replay: approving an already-approved code is a no-op.
		if (rec.status === "approved") return "ok" as ApproveResult;
		if (rec.status === "denied") return "denied" as ApproveResult;
		if (!approve) {
			await tx
				.update(deviceCodes)
				.set({ status: "denied" })
				.where(
					and(
						eq(deviceCodes.deviceCode, rec.deviceCode),
						eq(deviceCodes.status, "pending"),
					),
				);
			return "denied" as ApproveResult;
		}
		const name = rec.machineName ?? `machine-${rec.machineId.slice(0, 8)}`;
		const [taken] = await tx
			.select({ id: machines.id })
			.from(machines)
			.where(and(eq(machines.userId, userId), eq(machines.name, name)))
			.limit(1);
		if (taken) {
			await tx
				.update(deviceCodes)
				.set({ status: "denied" })
				.where(eq(deviceCodes.deviceCode, rec.deviceCode));
			return "duplicate" as ApproveResult;
		}
		await tx
			.update(deviceCodes)
			.set({ status: "approved" })
			.where(
				and(
					eq(deviceCodes.deviceCode, rec.deviceCode),
					eq(deviceCodes.status, "pending"),
				),
			);
		try {
			await tx.insert(machines).values({
				configVersion: "v1",
				id: rec.machineId,
				name,
				status: "enrolled",
				userId,
			});
		} catch {
			// Lost a concurrent same-name approval race: the unique index is
			// the real guard; the pre-check above only picks the error string.
			await tx
				.update(deviceCodes)
				.set({ status: "denied" })
				.where(eq(deviceCodes.deviceCode, rec.deviceCode));
			return "duplicate" as ApproveResult;
		}
		return "ok" as ApproveResult;
	});
}

export type PollResult =
	| { ok: true; token: string; machineId: string }
	| { ok: false; error: string };

export async function pollDeviceToken(
	device_code: string,
	client_id: string,
): Promise<PollResult> {
	const [rec] = await db
		.select()
		.from(deviceCodes)
		.where(eq(deviceCodes.deviceCode, device_code))
		.limit(1);
	if (!rec) return { error: "expired_token", ok: false };
	if (rec.clientId !== client_id) return { error: "access_denied", ok: false };
	const ageMs = Date.now() - rec.createdAt.getTime();
	if (ageMs > rec.expiresIn * 1000)
		return { error: "expired_token", ok: false };
	if (rec.status === "pending")
		return { error: "authorization_pending", ok: false };
	if (rec.status === "denied") return { error: "access_denied", ok: false };
	const [m] = await db
		.select({ userId: machines.userId })
		.from(machines)
		.where(eq(machines.id, rec.machineId))
		.limit(1);
	if (!m) return { error: "access_denied", ok: false };
	// Idempotent poll: a second poll after approval returns the same token
	// instead of minting a new live session per request.
	const [existingSession] = await db
		.select({ token: machineSessions.token })
		.from(machineSessions)
		.where(
			and(
				eq(machineSessions.machineId, rec.machineId),
				isNull(machineSessions.revoked),
			),
		)
		.limit(1);
	if (existingSession) {
		return {
			machineId: rec.machineId,
			ok: true,
			token: existingSession.token,
		};
	}
	const token = sessionToken();
	await db.insert(machineSessions).values({
		machineId: rec.machineId,
		token,
		userId: m.userId,
	});
	return { machineId: rec.machineId, ok: true, token };
}

export async function revokeMachine(
	userId: string,
	machineId: string,
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [m] = await tx
			.select({ id: machines.id })
			.from(machines)
			.where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
			.limit(1);
		if (!m) return false;
		await tx
			.update(machines)
			.set({ status: "revoked", updatedAt: new Date() })
			.where(eq(machines.id, machineId));
		await tx
			.update(machineSessions)
			.set({ revoked: new Date() })
			.where(eq(machineSessions.machineId, machineId));
		return true;
	});
}
