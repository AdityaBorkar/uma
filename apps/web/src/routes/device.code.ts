import { createFileRoute } from "@tanstack/react-router";

import { createDeviceCode } from "#/lib/machines/service.ts";

/**
 * `POST /device/code` — OAuth device-authorization shim for `uma-machine
 * enroll`. Exact wire shape (not the oRPC envelope): the CLI posts
 * `{client_id, machineName?, scope?}` and parses `DeviceCodeResponse`.
 * Canonical typed equivalent: `device.code` at `/api/rpc/device/code`.
 */
export const Route = createFileRoute("/device/code")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json().catch(() => ({}))) as {
					client_id?: string;
					machineName?: string;
				};
				if (!body.client_id) {
					return Response.json({ error: "invalid_request" }, { status: 400 });
				}
				const res = await createDeviceCode(
					body.client_id,
					body.machineName,
				).catch(() => null);
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
			},
		},
	},
});
