import { createFileRoute } from "@tanstack/react-router";

import { pollDeviceToken } from "#/lib/machines/service.ts";

/**
 * `POST /device/token` — device-flow poll shim for `uma-machine enroll`.
 * Returns the OAuth error vocabulary (`authorization_pending`, `expired_token`,
 * `access_denied`) with HTTP 400 bodies the CLI already parses — not the oRPC
 * envelope. Canonical typed equivalent: `device.token` at
 * `/api/rpc/device/token`.
 */
export const Route = createFileRoute("/device/token")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json().catch(() => ({}))) as {
					client_id?: string;
					device_code?: string;
					grant_type?: string;
				};
				if (!body.device_code || !body.client_id) {
					return Response.json({ error: "invalid_request" }, { status: 400 });
				}
				const res = await pollDeviceToken(
					body.device_code,
					body.client_id,
				).catch(() => null);
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
			},
		},
	},
});
