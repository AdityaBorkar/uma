import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { user } from "../db/auth.gen.ts";
import { db } from "../db/client.ts";
import { taskLogs } from "../db/machines.ts";
import { tasks } from "../db/tasks.ts";
import { e2eSeedEnabled } from "../machines/config.ts";
import {
	approveDevice,
	authMachine,
	bearerToken,
	heartbeatHistory,
} from "../machines/service.ts";

const DebugApproveBody = z.object({
	approve: z.boolean().optional(),
	user_code: z.string().min(1),
});

const DebugQueueTaskBody = z.object({
	projectId: z.string().nullable().optional(),
	prompt: z.string().optional(),
});

function notFound(): Response {
	return new Response("not found", { status: 404 });
}

/**
 * `POST /api/debug/approve {user_code, approve?}` — roundtrip/seed helper.
 * 404 unless `E2E_SEED=1`.
 */
export async function handleDebugApprove(request: Request): Promise<Response> {
	if (!e2eSeedEnabled()) return notFound();
	const parsed = DebugApproveBody.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return Response.json({ error: "user_code required" }, { status: 400 });
	}
	const body = parsed.data;
	// Fixed seed identity so roundtrip suites never leak a user row per call.
	const userId = "test-user-roundtrip";
	const now = new Date();
	await db
		.insert(user)
		.values({
			createdAt: now,
			email: `${userId}@example.test`,
			emailVerified: false,
			id: userId,
			name: "Roundtrip",
			updatedAt: now,
		})
		.onConflictDoNothing();
	const res = await approveDevice(
		userId,
		body.user_code,
		body.approve !== false,
	).catch(() => null);
	if (res === null) {
		return Response.json({ error: "server_error" }, { status: 500 });
	}
	if (res === "unknown") {
		return Response.json({ error: "unknown user_code" }, { status: 404 });
	}
	if (res === "duplicate") {
		return Response.json({ error: "duplicate machine name" }, { status: 409 });
	}
	return Response.json({ ok: true, userId });
}

/**
 * `GET /api/debug/heartbeats?machineId=` — roundtrip/seed helper.
 * 404 unless `E2E_SEED=1`.
 */
export async function handleDebugHeartbeats(
	request: Request,
): Promise<Response> {
	if (!e2eSeedEnabled()) return notFound();
	const sess = await authMachine(bearerToken(request.headers));
	if (!sess) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const machineId = new URL(request.url).searchParams.get("machineId") ?? "";
	if (machineId !== sess.machineId) {
		return Response.json({ error: "forbidden" }, { status: 403 });
	}
	const heartbeats = await heartbeatHistory(sess.machineId, sess.userId);
	return Response.json({ heartbeats });
}

/**
 * `POST /api/debug/queue-task` — roundtrip/seed helper. 404 unless
 * `E2E_SEED=1`.
 */
export async function handleDebugQueueTask(
	request: Request,
): Promise<Response> {
	if (!e2eSeedEnabled()) return notFound();
	const sess = await authMachine(bearerToken(request.headers));
	if (!sess) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const body =
		DebugQueueTaskBody.safeParse(await request.json().catch(() => null)).data ??
		{};
	const prompt = body.prompt ?? "test prompt";
	const [task] = await db
		.insert(tasks)
		.values({
			agent: "cli",
			id: crypto.randomUUID(),
			projectId: body.projectId ?? null,
			prompt,
			queuedAt: new Date(),
			status: "queued",
			title: prompt.slice(0, 200) || "seed task",
			userId: sess.userId,
		})
		.returning();
	return Response.json({ task });
}

/**
 * `GET /api/debug/task?id=` — roundtrip/seed helper. 404 unless
 * `E2E_SEED=1`.
 */
export async function handleDebugTask(request: Request): Promise<Response> {
	if (!e2eSeedEnabled()) return notFound();
	const sess = await authMachine(bearerToken(request.headers));
	if (!sess) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	const id = new URL(request.url).searchParams.get("id") ?? "";
	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, id), eq(tasks.userId, sess.userId)))
		.limit(1);
	if (!task) return Response.json({ task: null });
	const logs = await db
		.select({
			chunk: taskLogs.chunk,
			createdAt: taskLogs.createdAt,
			stream: taskLogs.stream,
		})
		.from(taskLogs)
		.where(eq(taskLogs.taskId, id))
		.orderBy(asc(taskLogs.createdAt));
	return Response.json({ task: { ...task, logs } });
}
