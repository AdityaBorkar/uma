import { createFileRoute } from "@tanstack/react-router";

import { handleConnectionCallback } from "#/lib/connections/callback.ts";

export const Route = createFileRoute("/api/connections/google")({
	server: {
		handlers: {
			GET: ({ request }) => handleConnectionCallback("google", request),
		},
	},
});
