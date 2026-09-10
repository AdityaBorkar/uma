import { createFileRoute } from "@tanstack/react-router";

import { latestVersion } from "#/lib/machines/service.ts";

/** `GET /api/version` — daemon upgrade gate (`{latest, min}`). */
export const Route = createFileRoute("/api/version")({
	server: {
		handlers: {
			GET: () => Response.json(latestVersion()),
		},
	},
});
