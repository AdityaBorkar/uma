import { ORPCError, os } from "@orpc/server";
import {
	DeviceCodeRequestSchema,
	DeviceCodeResponseSchema,
	DeviceTokenRequestSchema,
	DeviceTokenResponseSchema,
} from "@uma/orpc-contract";
import { z } from "zod";

import {
	approveDevice,
	createDeviceCode,
	pollDeviceToken,
} from "#/lib/machines/service.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";

/**
 * Device-code enrollment (apiContract `device.*`).
 * Inputs/outputs are the frozen contract schemas, so `uma-machine enroll`
 * keeps working against this server without a wire change.
 */

export const code = os
	.input(DeviceCodeRequestSchema)
	.output(DeviceCodeResponseSchema)
	.handler(async ({ input }) => {
		const res = await createDeviceCode(input.client_id, input.machineName);
		if (!res.ok) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					res.error === "invalid_client"
						? "Unknown client"
						: (res.detail ?? "Invalid machine name"),
			});
		}
		return res.record;
	});

export const token = os
	.input(DeviceTokenRequestSchema)
	.output(DeviceTokenResponseSchema)
	.errors({
		ACCESS_DENIED: {},
		AUTHORIZATION_PENDING: {},
		EXPIRED_TOKEN: {},
		SLOW_DOWN: {},
	})
	.handler(async ({ input, errors }) => {
		const res = await pollDeviceToken(input.device_code, input.client_id);
		if (res.ok) {
			return {
				access_token: res.token,
				machine_id: res.machineId,
				token_type: "Bearer" as const,
			};
		}
		switch (res.error) {
			case "authorization_pending":
				throw errors.AUTHORIZATION_PENDING();
			case "expired_token":
				throw errors.EXPIRED_TOKEN();
			case "access_denied":
				throw errors.ACCESS_DENIED();
			default:
				throw new ORPCError("BAD_REQUEST", { message: res.error });
		}
	});

/**
 * Browser approval for a `user_code` (web UI concern, not part of the frozen
 * wire contract). Creates the enrolled machine row on approve.
 */
export const approve = os
	.input(
		z.object({
			approve: z.boolean().default(true),
			user_code: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const res = await approveDevice(user.id, input.user_code, input.approve);
		if (res === "unknown") {
			throw new ORPCError("NOT_FOUND", { message: "Unknown code" });
		}
		if (res === "duplicate") {
			throw new ORPCError("CONFLICT", {
				message: "A machine with this name already exists",
			});
		}
		return { ok: true as const };
	});
