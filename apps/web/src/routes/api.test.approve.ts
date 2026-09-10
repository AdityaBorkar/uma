import { createFileRoute } from "@tanstack/react-router";

import { db } from "#/lib/db.ts";
import { e2eSeedEnabled } from "#/lib/machines/config.ts";
import { approveDevice } from "#/lib/machines/service.ts";
import { user } from "#/schemas/db/auth.gen.ts";

/**
 * `POST /api/test/approve {user_code, approve?}` — roundtrip/seed helper ONLY.
 * Returns 404 unless `E2E_SEED=1` (dev). Stands in for the browser approval UI
 * by approving as an ephemeral test user.
 */
export const Route = createFileRoute("/api/test/approve")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!e2eSeedEnabled()) {
					return new Response("not found", { status: 404 });
				}
				const body = (await request.json().catch(() => ({}))) as {
					approve?: boolean;
					user_code?: string;
				};
				if (!body.user_code) {
					return Response.json(
						{ error: "user_code required" },
						{ status: 400 },
					);
				}
				const userId = `test-user-${Date.now().toString(36)}`;
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
					return Response.json(
						{ error: "duplicate machine name" },
						{ status: 409 },
					);
				}
				return Response.json({ ok: true, userId });
			},
		},
	},
});
