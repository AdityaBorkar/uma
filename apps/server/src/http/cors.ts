import { allowedOrigins } from "../env.ts";

/**
 * CORS for browser callers (web UI on the public origin, vite dev locally).
 * Machine/CLI callers are non-browser and ignore these headers. Cookie auth
 * requires an explicit origin (never `*`) plus `credentials: include`.
 */
export function corsHeaders(request: Request): HeadersInit {
	const origin = request.headers.get("origin")?.replace(/\/+$/, "");
	if (!origin) return {};
	if (!allowedOrigins().includes(origin)) return {};
	return {
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Origin": origin,
		Vary: "Origin",
	};
}

export function withCors(request: Request, response: Response): Response {
	const headers = corsHeaders(request);
	const names = Object.keys(headers);
	if (names.length === 0) return response;
	const next = new Headers(response.headers);
	for (const [k, v] of Object.entries(headers)) next.set(k, String(v));
	return new Response(response.body, {
		headers: next,
		status: response.status,
		statusText: response.statusText,
	});
}

/** Preflight for the API surface. 204 with CORS headers when allowed. */
export function handlePreflight(request: Request): Response | null {
	if (request.method !== "OPTIONS") return null;
	const headers = corsHeaders(request);
	const next = new Headers(headers);
	next.set(
		"Access-Control-Allow-Headers",
		request.headers.get("access-control-request-headers") ??
			"authorization, content-type",
	);
	next.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
	);
	next.set("Access-Control-Max-Age", "600");
	return new Response(null, { headers: next, status: 204 });
}
