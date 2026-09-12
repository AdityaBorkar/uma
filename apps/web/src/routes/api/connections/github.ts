import { createFileRoute } from "@tanstack/react-router";

import { handleConnectionCallback } from "#/lib/connections/callback.ts";

export const Route = createFileRoute("/api/connections/github")({
	server: {
		handlers: {
			GET: ({ request }) => handleConnectionCallback("github", request),
		},
	},
});
