import { createFileRoute } from "@tanstack/react-router";

import { healthCounts } from "#/lib/machines/service.ts";

/** `GET /health` — liveness probe with row counts (no contents leaked). */
export const Route = createFileRoute("/health")({
	server: {
		handlers: {
			GET: async () => {
				const counts = await healthCounts().catch(() => null);
				if (!counts) {
					return Response.json({ ok: false }, { status: 500 });
				}
				return Response.json({
					machines: counts.machines,
					ok: true,
					tasks: counts.tasks,
				});
			},
		},
	},
});
