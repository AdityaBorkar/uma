import { createFileRoute } from "@tanstack/react-router";

import { authMachine, bearerToken, claimTask } from "#/lib/machines/service.ts";

/**
 * `POST /api/machines/claim` — atomic task claim for the device binary.
 *
 * Raw JSON in/out (`{taskId, machineId, sandboxId}` → `{ok, startedAt}` /
 * 409) so `uma-machine` needs no oRPC client library. Canonical typed
 * equivalent: `machines.claim` at `/api/rpc/machines/claim` (oRPC envelope).
 */
export const Route = createFileRoute("/api/machines/claim")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const sess = await authMachine(bearerToken(request.headers)).catch(
					() => null,
				);
				if (!sess) {
					return Response.json({ error: "unauthorized" }, { status: 401 });
				}
				const body = (await request.json().catch(() => ({}))) as {
					machineId?: string;
					sandboxId?: string;
					taskId?: string;
				};
				if (!body.taskId || !body.machineId || !body.sandboxId) {
					return Response.json(
						{ error: "taskId/machineId/sandboxId required" },
						{ status: 400 },
					);
				}
				if (body.machineId !== sess.machineId) {
					return Response.json({ error: "machine mismatch" }, { status: 403 });
				}
				const ok = await claimTask(
					body.taskId,
					sess.machineId,
					sess.userId,
					body.sandboxId,
				).catch(() => false);
				if (!ok) {
					return Response.json({ error: "conflict" }, { status: 409 });
				}
				return Response.json({ ok: true, startedAt: Date.now() });
			},
		},
	},
});
