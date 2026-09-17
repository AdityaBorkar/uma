import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Control-plane environment. Everything is runtime-only (Bun reads
 * `process.env` at startup) — there is no build-arg block by design.
 *
 * `PUBLIC_WEB_*` mirror the public web origin: they build user-facing URLs
 * (OAuth `redirect_uri`, device `verification_uri`) and seed the CORS
 * allowlist. They are not secrets.
 */
export const env = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		AUTH_SECRET: z.string().min(1),
		CORS_EXTRA_ORIGINS: z.string().optional(),
		DB_HOST: z.string().min(1),
		DB_PASSWORD: z.string().min(1),
		DB_PORT: z.coerce.number().min(1),
		DB_SSL: z.stringbool().default(false),
		DB_USER: z.string().min(1),
		E2E_SEED: z.stringbool().default(false),
		GITHUB_CLIENT_ID: z.string().min(1),
		GITHUB_CLIENT_SECRET: z.string().min(1),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		HOST: z.string().min(1).default("0.0.0.0"),
		MACHINE_CLIENT_ALLOWLIST: z.string().optional(),
		PORT: z.coerce.number().min(1).default(4000),
		PUBLIC_WEB_DOMAIN: z.string().min(1),
		PUBLIC_WEB_PORT: z.coerce.number().min(1),
		PUBLIC_WEB_SSL: z.stringbool().default(false),
	},
});

export const dbUrl = `postgres://${env.DB_USER}:${encodeURIComponent(env.DB_PASSWORD)}@${env.DB_HOST}:${env.DB_PORT}/control_plane${env.DB_SSL ? "?sslmode=require" : ""}`;

/** Public user-facing origin (web UI). Used for OAuth redirects + device URIs. */
export const publicWebUrl = `${env.PUBLIC_WEB_SSL ? "https" : "http"}://${env.PUBLIC_WEB_DOMAIN}:${env.PUBLIC_WEB_PORT}`;

function splitOrigins(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim().replace(/\/+$/, ""))
		.filter(Boolean);
}

/** Origins allowed to call this server with credentials (cookies). */
export function allowedOrigins(): string[] {
	const origins = new Set<string>([publicWebUrl]);
	// Local dev: vite web on :3000 (and :3001 fallback) against server :4000.
	if (process.env.NODE_ENV !== "production") {
		origins.add("http://127.0.0.1:3000");
		origins.add("http://localhost:3000");
		origins.add("http://127.0.0.1:3001");
		origins.add("http://localhost:3001");
	}
	for (const o of splitOrigins(env.CORS_EXTRA_ORIGINS)) origins.add(o);
	return [...origins];
}
