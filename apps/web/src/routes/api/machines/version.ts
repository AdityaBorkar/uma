import { createFileRoute } from "@tanstack/react-router";

import { latestVersion } from "#/lib/machines/service.ts";

/** `GET /api/machines/version` — daemon upgrade gate (`{latest, min}`). */
export const Route = createFileRoute("/api/machines/version")({
	server: {
		handlers: {
			GET: () => Response.json(latestVersion()),
		},
	},
});
