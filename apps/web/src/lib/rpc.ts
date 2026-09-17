import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import {
	createTanstackQueryUtils,
	type RouterUtils,
} from "@orpc/tanstack-query";
import type { QueryKey } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type router from "@uma/server/src/rpc/router.ts";

import { env, publicServerUrl } from "#/env.ts";

/**
 * oRPC client for the control plane (`apps/server`).
 *
 * `url` stays the same-origin path; `origin` selects the control plane:
 * browsers use the public origin (`PUBLIC_SERVER_URL`, undefined = same
 * origin via Caddy `/api/*`), SSR uses the internal origin with the inbound
 * request headers (cookies) forwarded per request. There is no in-process
 * router anymore — every call is HTTP.
 */
const getORPCClient = createIsomorphicFn()
	.server((): RouterClient<typeof router> => {
		const link = new RPCLink({
			headers: () => getRequestHeaders(),
			origin: env.CONTROL_PLANE_URL,
			url: "/api/rpc",
		});
		return createORPCClient(link);
	})
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			origin: publicServerUrl || undefined,
			url: "/api/rpc",
		});
		return createORPCClient(link);
	});

const client: RouterClient<typeof router> = getORPCClient();

export const rpc: RouterUtils<typeof client> = createTanstackQueryUtils(client);

/**
 * The procedure path from a `rpc.x.y.key()`. oRPC's `key()` is a full match
 * (it pins `type: "query"`), so invalidating a list that is consumed through
 * `infiniteOptions` needs this path-only prefix instead.
 */
export function rpcPathKey(key: QueryKey): QueryKey {
	return [key[0]];
}
