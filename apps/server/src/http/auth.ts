import { auth } from "../auth/server.ts";

/** better-auth handler (`/api/auth/*`). */
export function handleAuth(request: Request): Promise<Response> {
	return auth.handler(request);
}
