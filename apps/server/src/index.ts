import { auth } from "./auth/server.ts";
import { handleConnectionCallback } from "./connections/callback.ts";
import { env } from "./env.ts";
import { handlePreflight, withCors } from "./http/cors.ts";
import {
	handleDebugApprove,
	handleDebugHeartbeats,
	handleDebugQueueTask,
	handleDebugTask,
} from "./http/debug.ts";
import {
	handleClaim,
	handleDeviceCode,
	handleDeviceToken,
	handleHealth,
	handleVersion,
} from "./http/machines.ts";
import { handleMcpVersions } from "./http/mcp.ts";
import { handleModelProvidersDetect } from "./http/model-providers.ts";
import { handleOpenapi } from "./http/openapi.ts";
import { handleRpc } from "./http/rpc.ts";
import { handleSkillsVerify } from "./http/skills.ts";
import { handleWsUpgrade, type WsData, wsHandlers } from "./ws.ts";

/**
 * Uma control plane (`Bun.serve`).
 *
 * Single process: oRPC (`/api/rpc`), OpenAPI (`/api/openapi`), better-auth
 * (`/api/auth/*`), machine wire (`/api/machines/*` + WS), OAuth callbacks,
 * debug/seed helpers, and utility endpoints. All persistent state lives in
 * PostgreSQL (`src/db/`); live machine sockets are in-process
 * (`src/machines/sockets.ts`).
 */

function methodNotAllowed(allow: string): Response {
	return Response.json(
		{ error: `method not allowed (use ${allow})` },
		{ headers: { Allow: allow }, status: 405 },
	);
}

interface Route {
	handle: (request: Request, server: Bun.Server<WsData>) => Promise<Response>;
	method: string;
	path: string;
}

const routes: Route[] = [
	{
		handle: async () => handleHealth(),
		method: "GET",
		path: "/api/machines/health",
	},
	{
		handle: async () => handleVersion(),
		method: "GET",
		path: "/api/machines/version",
	},
	{
		handle: (r) => handleClaim(r),
		method: "POST",
		path: "/api/machines/claim",
	},
	{
		handle: (r) => handleDeviceCode(r),
		method: "POST",
		path: "/api/machines/device/code",
	},
	{
		handle: (r) => handleDeviceToken(r),
		method: "POST",
		path: "/api/machines/device/token",
	},
	{
		handle: (r) => handleConnectionCallback("github", r),
		method: "GET",
		path: "/api/connections/github",
	},
	{
		handle: (r) => handleConnectionCallback("google", r),
		method: "GET",
		path: "/api/connections/google",
	},
	{
		handle: (r) => handleDebugApprove(r),
		method: "POST",
		path: "/api/debug/approve",
	},
	{
		handle: (r) => handleDebugHeartbeats(r),
		method: "GET",
		path: "/api/debug/heartbeats",
	},
	{
		handle: (r) => handleDebugQueueTask(r),
		method: "POST",
		path: "/api/debug/queue-task",
	},
	{ handle: (r) => handleDebugTask(r), method: "GET", path: "/api/debug/task" },
	{
		handle: (r) => handleMcpVersions(r),
		method: "GET",
		path: "/api/mcp/versions",
	},
	{
		handle: (r) => handleSkillsVerify(r),
		method: "GET",
		path: "/api/skills/verify",
	},
	{
		handle: (r) => handleModelProvidersDetect(r),
		method: "GET",
		path: "/api/model-providers/detect",
	},
];

async function route(
	request: Request,
	server: Bun.Server<WsData>,
): Promise<Response> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method.toUpperCase();

	if (method === "GET" && pathname === "/") {
		return Response.json({ ok: true, service: "uma-control-plane" });
	}

	// Machine wire (frozen paths — the device binary hardcodes them).
	if (pathname === "/api/machines/ws") {
		return (
			(await handleWsUpgrade(request, server)) ??
			new Response("upgraded", { status: 101 })
		);
	}

	for (const r of routes) {
		if (r.path === pathname) {
			if (method !== r.method) return methodNotAllowed(r.method);
			return r.handle(request, server);
		}
	}

	// better-auth (handles its own sub-paths + methods).
	if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
		return auth.handler(request);
	}

	// oRPC + OpenAPI (own prefixes, all methods).
	if (pathname === "/api/rpc" || pathname.startsWith("/api/rpc/")) {
		return handleRpc(request);
	}
	if (pathname === "/api/openapi" || pathname.startsWith("/api/openapi/")) {
		return handleOpenapi(request);
	}

	return Response.json({ error: "not found" }, { status: 404 });
}

const server = Bun.serve<WsData>({
	fetch: async (request, srv) => {
		const preflight = handlePreflight(request);
		if (preflight) return preflight;
		try {
			return withCors(request, await route(request, srv));
		} catch (error) {
			console.error(
				`control-plane error: ${error instanceof Error ? error.message : String(error).slice(0, 300)}`,
			);
			return withCors(
				request,
				Response.json({ error: "internal error" }, { status: 500 }),
			);
		}
	},
	hostname: env.HOST,
	port: env.PORT,
	websocket: wsHandlers,
});

// eslint-disable-next-line no-console
console.log(`uma-control-plane listening on http://${env.HOST}:${env.PORT}`);

export { server };
