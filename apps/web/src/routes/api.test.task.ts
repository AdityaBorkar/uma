import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import { e2eSeedEnabled } from "#/lib/machines/config.ts";
import { authMachine, bearerToken } from "#/lib/machines/service.ts";
import { taskLogs } from "#/schemas/db/machines.ts";
import { tasks } from "#/schemas/db/tasks.ts";

/**
 * `GET /api/test/task?id=` — roundtrip/seed helper ONLY. Returns 404 unless
 * `E2E_SEED=1` (dev). Machine-Bearer authed; scoped to the machine's user.
 */
export const Route = createFileRoute("/api/test/task")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!e2eSeedEnabled()) {
					return new Response("not found", { status: 404 });
				}
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
			},
		},
	},
});
