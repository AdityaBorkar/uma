import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { env } from "#/env.ts";

export interface SessionUser {
	email: string;
	id: string;
	image?: string | null | undefined;
	name: string;
}

/**
 * Web route gate: reads the session from the control plane
 * (`apps/server`, better-auth) by forwarding the inbound cookies. Returns
 * `null` when unauthenticated — callers redirect to `/`.
 */
export const getServerSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<{ user: SessionUser } | null> => {
		const res = await fetch(`${env.CONTROL_PLANE_URL}/api/auth/get-session`, {
			headers: getRequestHeaders(),
		}).catch(() => null);
		if (res?.ok !== true) return null;
		const data = (await res.json().catch(() => null)) as {
			user?: SessionUser | null;
		} | null;
		if (!data?.user) return null;
		return { user: data.user };
	},
);
