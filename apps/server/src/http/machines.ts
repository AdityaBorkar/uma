import { z } from "zod";

import { assertSessionOwnsMachine } from "../machines/auth.ts";
import {
	authMachine,
	bearerToken,
	claimTask,
	createDeviceCode,
	healthCounts,
	latestVersion,
	pollDeviceToken,
} from "../machines/service.ts";

const ClaimBody = z.object({
	machineId: z.string().min(1),
	sandboxId: z.string().min(1),
	taskId: z.string().min(1),
});

const DeviceCodeBody = z.object({
	client_id: z.string().min(1),
	machineName: z.string().optional(),
});

const DeviceTokenBody = z.object({
	client_id: z.string().min(1),
	device_code: z.string().min(1),
	grant_type: z.string().optional(),
});

function parseBody<T>(schema: z.ZodType<T>, raw: unknown): T | null {
	const res = schema.safeParse(raw);
	return res.success ? res.data : null;
}

/**
 * `POST /api/machines/claim` — atomic task claim for the device binary.
 * Raw JSON in/out (`{taskId, machineId, sandboxId}` → `{ok, startedAt}` /
 * 409) so `uma-machine` needs no oRPC client library. Canonical typed
 * equivalent: `machines.claim` at `/api/rpc/machines/claim`.
 */
export async function handleClaim(request: Request): Promise<Response> {
	const sess = await authMachine(bearerToken(request.headers)).catch(
		() => null,
	);
	if (!sess) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const body = parseBody(ClaimBody, await request.json().catch(() => null));
	if (!body) {
		return Response.json(
			{ error: "taskId/machineId/sandboxId required" },
			{ status: 400 },
		);
	}
	try {
		assertSessionOwnsMachine(sess, body.machineId);
	} catch {
		return Response.json({ error: "machine mismatch" }, { status: 403 });
	}
	const startedAt = await claimTask(
		body.taskId,
		sess.machineId,
		sess.userId,
		body.sandboxId,
	).catch(() => null);
	if (!startedAt) {
		return Response.json({ error: "conflict" }, { status: 409 });
	}
	return Response.json({ ok: true, startedAt: startedAt.getTime() });
}

/**
 * `POST /api/machines/device/code` — OAuth device-authorization shim.
 * Canonical typed equivalent: `device.code` at `/api/rpc/device/code`.
 */
export async function handleDeviceCode(request: Request): Promise<Response> {
	const body = parseBody(
		DeviceCodeBody,
		await request.json().catch(() => null),
	);
	if (!body) {
		return Response.json({ error: "invalid_request" }, { status: 400 });
	}
	const res = await createDeviceCode(body.client_id, body.machineName).catch(
		() => null,
	);
	if (!res) {
		return Response.json({ error: "server_error" }, { status: 500 });
	}
	if (!res.ok) {
		if (res.error === "invalid_client") {
			return Response.json({ error: "invalid_client" }, { status: 400 });
		}
		return Response.json(
			{ detail: res.detail, error: "invalid_name" },
			{ status: 400 },
		);
	}
	return Response.json(res.record);
}

/**
 * `POST /api/machines/device/token` — device-flow poll shim. Returns the
 * OAuth error vocabulary (`authorization_pending`, `expired_token`,
 * `access_denied`) with HTTP 400 bodies the CLI already parses.
 * Canonical typed equivalent: `device.token` at `/api/rpc/device/token`.
 */
export async function handleDeviceToken(request: Request): Promise<Response> {
	const body = parseBody(
		DeviceTokenBody,
		await request.json().catch(() => null),
	);
	if (!body) {
		return Response.json({ error: "invalid_request" }, { status: 400 });
	}
	const res = await pollDeviceToken(body.device_code, body.client_id).catch(
		() => null,
	);
	if (!res) {
		return Response.json({ error: "server_error" }, { status: 500 });
	}
	if (!res.ok) {
		return Response.json({ error: res.error }, { status: 400 });
	}
	return Response.json({
		access_token: res.token,
		machine_id: res.machineId,
		token_type: "Bearer",
	});
}

/** `GET /api/machines/health` — liveness probe with row counts. */
export async function handleHealth(): Promise<Response> {
	const counts = await healthCounts().catch(() => null);
	if (!counts) {
		return Response.json({ ok: false }, { status: 500 });
	}
	return Response.json({
		machines: counts.machines,
		ok: true,
		tasks: counts.tasks,
	});
}

/** `GET /api/machines/version` — daemon upgrade gate (`{latest, min}`). */
export function handleVersion(): Response {
	return Response.json(latestVersion());
}
