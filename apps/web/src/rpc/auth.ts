import { ORPCError } from "@orpc/server";

import { getAuthSession } from "#/lib/auth/server.ts";

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
