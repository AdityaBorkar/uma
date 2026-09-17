import { ORPCError, os } from "@orpc/server";

import { getAuthSession } from "../auth/server.ts";
import { authMachine, bearerToken } from "../machines/service.ts";

export interface RpcContext {
	headers: Headers;
}

export async function requireUser(headers: Headers) {
	const session = await getAuthSession(headers);
	if (!session?.user) {
		throw new ORPCError("UNAUTHORIZED", { message: "Not authenticated" });
	}
	return session.user;
}

/** Machine Bearer auth for device-enrolled callers (daemon/CLI). */
export async function requireMachine(headers: Headers) {
	const sess = await authMachine(bearerToken(headers));
	if (!sess) {
		throw new ORPCError("UNAUTHORIZED", { message: "Invalid machine token" });
	}
	return sess;
}

/**
 * Base procedure for browser-cookie-authenticated handlers. Injects `user`
 * so handlers never call `requireUser` or cast `context` themselves.
 */
export const authed = os
	.$context<RpcContext>()
	.use(async ({ context, next }) => {
		const user = await requireUser(context.headers);
		return next({ context: { user } });
	});
