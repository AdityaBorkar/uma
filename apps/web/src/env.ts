import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	client: {
		// PUBLIC_POSTHOG_HOST: z.url(),
		// PUBLIC_POSTHOG_KEY: z.string().min(1),
		PUBLIC_WEB_DOMAIN: z.string().min(1),
		PUBLIC_WEB_PORT: z.coerce.number().min(1024),
		PUBLIC_WEB_SSL: z.stringbool(),
	},
	clientPrefix: "PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: typeof window === "undefined" ? process.env : import.meta.env,
	server: {
		AUTH_SECRET: z.string().min(1),
		DB_HOST: z.string().min(1),
		DB_PASSWORD: z.string().min(1),
		DB_PORT: z.coerce.number().min(1024),
		DB_SSL: z.stringbool(),
		DB_USER: z.string().min(1),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
	},
});

export const dbUrl = `postgres://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/control_plane?${env.DB_SSL ? "sslmode=require" : ""}`;

export const serverUrl = `${env.PUBLIC_WEB_SSL ? "https" : "http"}://${env.PUBLIC_WEB_DOMAIN}:${env.PUBLIC_WEB_PORT}`;
