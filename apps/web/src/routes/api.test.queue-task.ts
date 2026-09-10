import { createFileRoute } from "@tanstack/react-router";

import { db } from "#/lib/db.ts";
import { e2eSeedEnabled } from "#/lib/machines/config.ts";
import { authMachine, bearerToken } from "#/lib/machines/service.ts";
import { tasks } from "#/schemas/db/tasks.ts";

/**
 * `POST /api/test/queue-task` — roundtrip/seed helper ONLY. Returns 404
 * unless `E2E_SEED=1` (dev). Machine-Bearer authed; the task is owned by the
 * machine's user so the daemon can claim it via `machines.claim`.
 */
export const Route = createFileRoute("/api/test/queue-task")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!e2eSeedEnabled()) {
					return new Response("not found", { status: 404 });
				}
				const sess = await authMachine(bearerToken(request.headers));
				if (!sess) {
					return Response.json({ error: "unauthorized" }, { status: 401 });
				}
				const body = (await request.json().catch(() => ({}))) as {
					projectId?: string | null;
					prompt?: string;
				};
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
			},
		},
	},
});
