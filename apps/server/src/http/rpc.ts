import { RPCHandler } from "@orpc/server/fetch";

import router from "../rpc/router.ts";

const handler = new RPCHandler(router);

/** oRPC frontend↔backend surface at `/api/rpc`. */
export async function handleRpc(request: Request): Promise<Response> {
	const { response } = await handler.handle(request, {
		context: { headers: request.headers },
		prefix: "/api/rpc",
	});
	return response ?? new Response("Not Found", { status: 404 });
}
