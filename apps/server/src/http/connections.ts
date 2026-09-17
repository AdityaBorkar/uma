import { handleConnectionCallback } from "../connections/callback.ts";

/** `GET /api/connections/github` — GitHub OAuth callback. */
export function handleGithubCallback(request: Request): Promise<Response> {
	return handleConnectionCallback("github", request);
}

/** `GET /api/connections/google` — Google OAuth callback. */
export function handleGoogleCallback(request: Request): Promise<Response> {
	return handleConnectionCallback("google", request);
}
