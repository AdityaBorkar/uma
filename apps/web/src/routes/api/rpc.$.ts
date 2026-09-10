import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/react-router";

import router from "#/rpc/router.ts";

const handler = new RPCHandler(router);

async function handle({ request }: { request: Request }) {
	const { response } = await handler.handle(request, {
		context: { headers: request.headers },
		prefix: "/api/rpc",
	});

	return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: handle,
		},
	},
});
