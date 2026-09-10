import { z } from "zod";

// oRPC / HTTPS contract (server-owned, consumed here)

export const DeviceCodeRequestSchema = z.object({
	client_id: z.string().min(1),
	machineName: z.string().min(1).optional(),
	scope: z.string().optional(),
});
export type DeviceCodeRequest = z.infer<typeof DeviceCodeRequestSchema>;

export const DeviceCodeResponseSchema = z.object({
	device_code: z.string().min(1),
	expires_in: z.number().int().positive(),
	interval: z.number().int().positive(),
	user_code: z.string().min(1),
	verification_uri: z.string().min(1),
	verification_uri_complete: z.string().min(1),
});
export type DeviceCodeResponse = z.infer<typeof DeviceCodeResponseSchema>;

export const DeviceTokenRequestSchema = z.object({
	client_id: z.string().min(1),
	device_code: z.string().min(1),
	grant_type: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
});
export type DeviceTokenRequest = z.infer<typeof DeviceTokenRequestSchema>;

export const DeviceTokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().int().positive().optional(),
	machine_id: z.string().min(1),
	token_type: z.literal("Bearer"),
});
export type DeviceTokenResponse = z.infer<typeof DeviceTokenResponseSchema>;

export const DeviceTokenErrorSchema = z.object({
	error: z.enum([
		"authorization_pending",
		"slow_down",
		"expired_token",
		"access_denied",
	]),
	error_description: z.string().optional(),
});
export type DeviceTokenError = z.infer<typeof DeviceTokenErrorSchema>;

export const TaskClaimRequestSchema = z.object({
	machineId: z.string().min(1),
	sandboxId: z.string().min(1),
	taskId: z.string().min(1),
});
export type TaskClaimRequest = z.infer<typeof TaskClaimRequestSchema>;

export const DriftEntrySchema = z.object({
	detail: z.string().optional(),
	drifted: z.boolean(),
	key: z.string(),
});
export type DriftEntry = z.infer<typeof DriftEntrySchema>;

export const ReceiptSchema = z.object({
	error: z.string().optional(),
	key: z.string(),
	ok: z.boolean(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;
