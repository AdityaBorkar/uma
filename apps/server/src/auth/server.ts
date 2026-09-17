import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { multiSession } from "better-auth/plugins";

import { db } from "../db/client.ts";
import * as schema from "../db/index.ts";
import { env, publicWebUrl } from "../env.ts";

export const auth = betterAuth({
	baseURL: publicWebUrl,
	database: drizzleAdapter(db, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: false,
	},
	plugins: [multiSession()],
	secret: env.AUTH_SECRET,
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
	// The control plane sits behind Caddy on the public web origin; trust it
	// so OAuth callbacks and cookie session reads work through the proxy.
	// (baseURL above pins callbacks to the same origin.)
	trustedOrigins: [publicWebUrl],
});

/** Single session lookup shared by oRPC handlers and HTTP routes. */
export async function getAuthSession(headers: Headers) {
	return auth.api.getSession({ headers });
}
