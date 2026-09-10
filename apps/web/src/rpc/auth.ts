import { ORPCError } from "@orpc/server";

import { getAuthSession } from "#/lib/auth/server.ts";
import { authMachine, bearerToken } from "#/lib/machines/service.ts";

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
