import { env } from "./env.ts";
import { handleAuth } from "./http/auth.ts";
import {
	handleGithubCallback,
	handleGoogleCallback,
} from "./http/connections.ts";
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
	if (pathname === "/api/machines/health") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleHealth();
	}
	if (pathname === "/api/machines/version") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleVersion();
	}
	if (pathname === "/api/machines/claim") {
		if (method !== "POST") return methodNotAllowed("POST");
		return handleClaim(request);
	}
	if (pathname === "/api/machines/device/code") {
		if (method !== "POST") return methodNotAllowed("POST");
		return handleDeviceCode(request);
	}
	if (pathname === "/api/machines/device/token") {
		if (method !== "POST") return methodNotAllowed("POST");
		return handleDeviceToken(request);
	}

	// better-auth (handles its own sub-paths + methods).
	if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
		return handleAuth(request);
	}

	// oRPC + OpenAPI (own prefixes, all methods).
	if (pathname === "/api/rpc" || pathname.startsWith("/api/rpc/")) {
		return handleRpc(request);
	}
	if (pathname === "/api/openapi" || pathname.startsWith("/api/openapi/")) {
		return handleOpenapi(request);
	}

	// OAuth callbacks.
	if (pathname === "/api/connections/github") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleGithubCallback(request);
	}
	if (pathname === "/api/connections/google") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleGoogleCallback(request);
	}

	// Debug/seed helpers (each 404s unless E2E_SEED=1).
	if (pathname === "/api/debug/approve") {
		if (method !== "POST") return methodNotAllowed("POST");
		return handleDebugApprove(request);
	}
	if (pathname === "/api/debug/heartbeats") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleDebugHeartbeats(request);
	}
	if (pathname === "/api/debug/queue-task") {
		if (method !== "POST") return methodNotAllowed("POST");
		return handleDebugQueueTask(request);
	}
	if (pathname === "/api/debug/task") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleDebugTask(request);
	}

	// Utility endpoints.
	if (pathname === "/api/mcp/versions") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleMcpVersions(request);
	}
	if (pathname === "/api/skills/verify") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleSkillsVerify(request);
	}
	if (pathname === "/api/model-providers/detect") {
		if (method !== "GET") return methodNotAllowed("GET");
		return handleModelProvidersDetect(request);
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
