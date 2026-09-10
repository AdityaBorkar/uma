import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { getAuthSession } from "#/lib/auth/server.ts";

export const getServerSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getAuthSession(getRequestHeaders());
		return session ?? null;
	},
);
