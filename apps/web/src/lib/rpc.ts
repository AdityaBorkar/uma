import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { QueryKey } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import router from "#/rpc/router.ts";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(router, {
			context: () => ({
				headers: getRequestHeaders(),
			}),
		}),
	)
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			url: `${window.location.origin}/api/rpc`,
		});
		return createORPCClient(link);
	});

const client: RouterClient<typeof router> = getORPCClient();

export const rpc = createTanstackQueryUtils(client);

/**
 * The procedure path from a `rpc.x.y.key()`. oRPC's `key()` is a full match
 * (it pins `type: "query"`), so invalidating a list that is consumed through
 * `infiniteOptions` needs this path-only prefix instead.
 */
export function rpcPathKey(key: QueryKey): QueryKey {
	return [key[0]];
}
