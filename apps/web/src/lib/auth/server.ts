import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { env } from "#/env.ts";
import { db } from "#/lib/db.ts";
import * as schema from "#/schemas/db/index.ts";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: false,
	},
	plugins: [tanstackStartCookies()],
	secret: env.AUTH_SECRET,
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
});

/** Single session lookup shared by oRPC, server functions, and route gates. */
export async function getAuthSession(headers: Headers) {
	return auth.api.getSession({ headers });
}
