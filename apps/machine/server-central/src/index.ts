// Test server (temporary, for testing only). Implements the versioned v1
// contract from ../orpc-contract: device flow, ws at /api/machines/ws,
// and oRPC-like HTTPS procedures used by the agent + roundtrip script.

import { MachineNameSchema } from "../../orpc-contract/src/index.ts";
import { store } from "./store.ts";
import { handleMachineFrame, sendToMachine, trackSocket } from "./ws.ts";

/** Pre-bound client allowlist (validateClient mirror; revoke = session revoke). */
const ALLOWED_CLIENTS = (
	process.env.TEST_CLIENT_ALLOWLIST ?? "uma-machine,roundtrip"
)
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

const PORT = parseInt(process.env.PORT ?? process.env.TEST_PORT ?? "3030", 10);

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		headers: { "content-type": "application/json" },
		status,
	});
}

function bearer(req: Request): string | null {
	const h = req.headers.get("authorization");
	if (!h) return null;
	const m = h.match(/^Bearer\s+(.+)$/i);
	return m?.[1] ?? null;
}

Bun.serve({
	async fetch(req, srv) {
		const url = new URL(req.url);
		const path = url.pathname;

		// --- WebSocket upgrade ---
		if (path === "/api/machines/ws") {
			const token = bearer(req) ?? url.searchParams.get("token");
			const sess = store.auth(token);
			if (!sess) return new Response("unauthorized", { status: 401 });
			const machine = store.machines.get(sess.machineId);
			if (!machine || machine.status === "revoked") {
				return new Response("revoked", { status: 401 });
			}
			const ok = (
				srv as unknown as { upgrade: (r: Request, o: unknown) => boolean }
			).upgrade(req, { data: { machineId: sess.machineId } });
			if (!ok) return new Response("upgrade failed", { status: 500 });
			return undefined as unknown as Response;
		}

		// --- Device flow ---
		if (path === "/device/code" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				client_id?: string;
				machineName?: string;
			};
			if (!body.client_id) return json({ error: "invalid_request" }, 400);
			if (!ALLOWED_CLIENTS.includes(body.client_id)) {
				return json({ error: "invalid_client" }, 400);
			}
			if (body.machineName !== undefined) {
				const v = MachineNameSchema.safeParse(body.machineName);
				if (!v.success) {
					return json(
						{ detail: v.error.issues[0]?.message, error: "invalid_name" },
						400,
					);
				}
			}
			const rec = store.createDevice(body.client_id, body.machineName);
			return json({
				device_code: rec.device_code,
				expires_in: rec.expires_in,
				interval: rec.interval,
				user_code: rec.user_code,
				verification_uri: rec.verification_uri,
				verification_uri_complete: rec.verification_uri_complete,
			});
		}
		if (path === "/device/token" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				grant_type?: string;
				device_code?: string;
				client_id?: string;
			};
			if (!body.device_code || !body.client_id) {
				return json({ error: "invalid_request" }, 400);
			}
			if (!ALLOWED_CLIENTS.includes(body.client_id)) {
				return json({ error: "invalid_client" }, 400);
			}
			// slow_down simulation: unsupported, always authorization_pending path.
			const r = store.pollToken(body.device_code, body.client_id);
			if (!r.ok) {
				const status = r.error === "authorization_pending" ? 400 : 400;
				return json({ error: r.error }, status);
			}
			return json({
				access_token: r.token,
				machine_id: r.machineId,
				token_type: "Bearer",
			});
		}
		// Test-only approval endpoint (stands in for the uma web approval UI).
		if (path === "/device/approve" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				user_code?: string;
				approve?: boolean;
			};
			if (!body.user_code) return json({ error: "user_code required" }, 400);
			const res = store.approveDevice(body.user_code, body.approve !== false);
			if (res === "unknown") return json({ error: "unknown user_code" }, 404);
			if (res === "duplicate") {
				return json(
					{ error: "duplicate machine name (UNIQUE(userId,name))" },
					409,
				);
			}
			return json({ ok: true });
		}
		if (path === "/device" && req.method === "GET") {
			return new Response(
				`<html><body><h1>Test approval page</h1><p>POST /device/approve with user_code to approve.</p></body></html>`,
				{ headers: { "content-type": "text/html" } },
			);
		}

		// --- Version / install ---
		if (path === "/api/version" && req.method === "GET") {
			return json({ latest: "0.1.0", min: store.minCliVersion });
		}
		if (path === "/rpc/machines.latestVersion" && req.method === "POST") {
			return json({ latest: "0.1.0", min: store.minCliVersion });
		}

		// --- Auth-guarded RPCs ---
		const sess = store.auth(bearer(req));
		const needAuth = path.startsWith("/rpc/");
		if (needAuth && !sess) return json({ error: "unauthorized" }, 401);
		if (needAuth && sess) {
			const m = store.machines.get(sess.machineId);
			if (!m || m.status === "revoked") return json({ error: "revoked" }, 401);
		}

		if (path === "/rpc/tasks.claim" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				taskId?: string;
				machineId?: string;
				sandboxId?: string;
			};
			if (!body.taskId || !body.machineId || !body.sandboxId) {
				return json({ error: "taskId/machineId/sandboxId required" }, 400);
			}
			const ok = store.claim(body.taskId, body.machineId, body.sandboxId);
			if (!ok) return json({ error: "conflict", status: "409" }, 409);
			return json({ ok: true, startedAt: Date.now() });
		}
		if (path === "/rpc/machines.heartbeatHistory" && req.method === "POST") {
			if (!sess) return json({ error: "unauthorized" }, 401);
			const rows = store.heartbeats.get(sess.machineId) ?? [];
			return json({ heartbeats: rows });
		}
		if (path === "/rpc/machines.sandboxList" && req.method === "GET") {
			return json({ sandboxes: [] });
		}
		if (path === "/rpc/machines.checkState" && req.method === "POST") {
			return json({ drift: [], version: "v1" });
		}
		if (path === "/rpc/machines.resetState" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				keys?: string[] | "*";
			};
			return json({ jobId: `job_${Date.now()}`, keys: body.keys ?? "*" });
		}

		// --- Test helpers (no auth; localhost only assumption for temp server) ---
		if (path === "/test/queue-task" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				id?: string;
				projectId?: string | null;
				prompt?: string;
				repoUrl?: string;
				branch?: string;
				commit?: string;
			};
			const t = store.queueTask({
				branch: body.branch,
				commit: body.commit,
				id: body.id,
				projectId: body.projectId ?? null,
				prompt: body.prompt ?? "test prompt",
				repoUrl: body.repoUrl ?? "",
			});
			return json({ task: t });
		}
		if (path === "/test/tasks" && req.method === "GET") {
			return json({ tasks: [...store.tasks.values()] });
		}
		if (path === "/test/task" && req.method === "GET") {
			const id = url.searchParams.get("id") ?? "";
			return json({ task: store.tasks.get(id) ?? null });
		}
		if (path === "/test/signals" && req.method === "GET") {
			return json({ signals: store.signals });
		}
		if (path === "/test/machines" && req.method === "GET") {
			return json({ machines: [...store.machines.values()] });
		}
		if (path === "/test/heartbeats" && req.method === "GET") {
			const id = url.searchParams.get("machineId") ?? "";
			return json({ heartbeats: store.heartbeats.get(id) ?? [] });
		}
		if (path === "/test/assign" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				machineId?: string;
				taskId?: string;
				projectId?: string | null;
				prompt?: string;
				repoUrl?: string;
				limits?: { maxRunning?: number; maxTotal?: number };
			};
			if (!body.machineId || !body.taskId) {
				return json({ error: "machineId/taskId required" }, 400);
			}
			const task = store.tasks.get(body.taskId);
			if (!task) return json({ error: "unknown task" }, 404);
			const frame = {
				branch: task.branch,
				commit: task.commit,
				projectId: body.projectId ?? task.projectId,
				prompt: body.prompt ?? task.prompt,
				repoUrl: body.repoUrl ?? task.repoUrl ?? "",
				t: "assign",
				taskId: body.taskId,
				...(body.limits ? { limits: body.limits } : {}),
			};
			const sent = sendToMachine(body.machineId, frame);
			return json({ frame, sent });
		}
		if (path === "/test/cancel" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				machineId?: string;
				taskId?: string;
			};
			if (!body.machineId || !body.taskId) {
				return json({ error: "machineId/taskId required" }, 400);
			}
			const sent = sendToMachine(body.machineId, {
				t: "cancel",
				taskId: body.taskId,
			});
			return json({ sent });
		}
		if (path === "/test/reset-config" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				machineId?: string;
				keys?: string[] | "*";
				payload?: Record<string, unknown>;
			};
			if (!body.machineId) return json({ error: "machineId required" }, 400);
			const frame = {
				jobId: `job_${Date.now()}`,
				keys: body.keys ?? "*",
				payload: body.payload ?? {},
				t: "reset-config",
				version: "v1",
			};
			const sent = sendToMachine(body.machineId, frame);
			return json({ frame, sent });
		}
		if (path === "/test/revoke" && req.method === "POST") {
			const body = (await req.json().catch(() => ({}))) as {
				machineId?: string;
			};
			if (!body.machineId) return json({ error: "machineId required" }, 400);
			store.revokeMachine(body.machineId);
			return json({ ok: true });
		}
		if (path === "/test/reset" && req.method === "POST") {
			store.tasks.clear();
			store.signals.length = 0;
			return json({ ok: true });
		}
		if (path === "/health" && req.method === "GET") {
			return json({
				machines: store.machines.size,
				ok: true,
				tasks: store.tasks.size,
			});
		}

		return new Response("not found", { status: 404 });
	},
	port: PORT,
	websocket: {
		close(ws) {
			const untrack = (ws as unknown as { __untrack?: () => void }).__untrack;
			try {
				untrack?.();
			} catch {
				// ignore
			}
		},
		message(ws, message) {
			const machineId = (
				(ws as unknown as { data: unknown }).data as { machineId: string }
			).machineId;
			let data: unknown;
			try {
				data = JSON.parse(String(message));
			} catch {
				return;
			}
			// Unknown inbound t from machine: logged + ignored server-side too.
			const t = (data as Record<string, unknown>).t;
			if (
				t !== "heartbeat" &&
				t !== "log" &&
				t !== "task-done" &&
				t !== "check-ack" &&
				t !== "reset-ack" &&
				t !== "sync-ack" &&
				t !== "claim-ack" &&
				t !== "quota-exceeded"
			) {
				return;
			}
			handleMachineFrame(machineId, data, (f) => {
				try {
					ws.send(JSON.stringify(f));
				} catch {
					// ignore
				}
			});
		},
		open(ws) {
			const machineId = (
				(ws as unknown as { data: unknown }).data as { machineId: string }
			).machineId;
			(ws as unknown as { __untrack?: () => void }).__untrack = trackSocket(
				machineId,
				ws,
			);
		},
	},
});

console.log(`server-central (test) listening on http://127.0.0.1:${PORT}`);
console.log(`ws: ws://127.0.0.1:${PORT}/api/machines/ws`);
