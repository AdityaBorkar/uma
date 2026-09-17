import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Web (UI) environment.
 *
 * - `PUBLIC_*` are build-time client vars (baked by Vite; need a Dockerfile
 *   `ARG` each — see `scripts/check-env.ts`).
 * - `CONTROL_PLANE_URL` is runtime-only: the absolute internal origin the web
 *   SSR server uses to reach the control plane (`apps/server`). Browsers use
 *   `PUBLIC_SERVER_URL` (empty = same origin, proxied via Caddy `/api/*`).
 */
export const env = createEnv({
	client: {
		PUBLIC_SERVER_URL: z.string().optional(),
		PUBLIC_WEB_DOMAIN: z.string().min(1),
		PUBLIC_WEB_PORT: z.coerce.number().min(1024),
		PUBLIC_WEB_SSL: z.stringbool(),
	},
	clientPrefix: "PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: typeof window === "undefined" ? process.env : import.meta.env,
	server: {
		CONTROL_PLANE_URL: z.string().min(1).default("http://127.0.0.1:4000"),
	},
});

/** Public user-facing origin (this UI). */
export const serverUrl = `${env.PUBLIC_WEB_SSL ? "https" : "http"}://${env.PUBLIC_WEB_DOMAIN}:${env.PUBLIC_WEB_PORT}`;

/**
 * Browser control-plane base (`""` = same origin). Server-only callers must
 * use `env.CONTROL_PLANE_URL` instead (SSR has no origin for relative URLs).
 */
export const publicServerUrl = env.PUBLIC_SERVER_URL?.replace(/\/+$/, "") ?? "";

/** Prefix a control-plane path with the browser base (`/api/…`). */
export function apiUrl(path: `/${string}`): string {
	return `${publicServerUrl}${path}`;
}
