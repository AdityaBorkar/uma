import { createFileRoute } from "@tanstack/react-router";

import { e2eSeedEnabled } from "#/lib/machines/config.ts";
import {
	authMachine,
	bearerToken,
	heartbeatHistory,
} from "#/lib/machines/service.ts";

/**
 * `GET /api/test/heartbeats?machineId=` — roundtrip/seed helper ONLY. Returns
 * 404 unless `E2E_SEED=1` (dev). The machineId must match the caller.
 */
export const Route = createFileRoute("/api/test/heartbeats")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!e2eSeedEnabled()) {
					return new Response("not found", { status: 404 });
				}
				const sess = await authMachine(bearerToken(request.headers));
				if (!sess) {
					return Response.json({ error: "unauthorized" }, { status: 401 });
				}
				const machineId =
					new URL(request.url).searchParams.get("machineId") ?? "";
				if (machineId !== sess.machineId) {
					return Response.json({ error: "forbidden" }, { status: 403 });
				}
				const heartbeats = await heartbeatHistory(sess.machineId, sess.userId);
				return Response.json({ heartbeats });
			},
		},
	},
});
