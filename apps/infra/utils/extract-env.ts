/**
 * Environment-variable wiring for the Pulumi layer, in one place.
 *
 * `APP_ENV_VARS` is the single source of truth for container environment
 * variables. Every var the containers read is declared here exactly once:
 * server vars are validated in `apps/server/src/env.ts`, web vars in
 * `apps/web/src/env.ts`. `appEnvValues` (consumed by
 * `apps/infra/docker/server.ts` / `web.ts`) derives both the Docker build
 * args and the runtime container envs from this manifest. The build-arg
 * block in `apps/web/Dockerfile` must list every `build: true` var
 * (the server image takes no build args — all server config is runtime
 * env); `bun run check:env` in `apps/web` (`scripts/check-env.ts`)
 * verifies the three files stay in sync.
 *
 * `extractEnv` flattens Pulumi stack config into a plain `name -> value` map.
 * Its consumer is `apps/infra/utils/run-command.ts`, which parses
 * `pulumi config --json --show-secrets` output to spawn commands with sourced
 * env vars.
 *
 * Config keys are namespaced (`namespace:NAME`); `extractEnv` optionally
 * scopes to one namespace, strips the prefix, and returns a flat map sorted
 * by name.
 */

import * as pulumi from "@pulumi/pulumi";

export type AppEnvVar = {
	name: string;
	/**
	 * Passed to the image build as a Docker build arg (the Dockerfile needs an
	 * `ARG` for it). Vite bakes `PUBLIC_*` client vars into the bundle at build
	 * time, so they must be build args in addition to runtime env. Secrets must
	 * never be build args. Defaults to false (runtime-only).
	 */
	build?: boolean;
	/** Which Pulumi config namespace holds the value, or "derived" in app.ts. */
	source: "app" | "postgres" | "derived";
	/** Read with `config.get` (empty string when unset) instead of `require`. */
	optional?: boolean;
	/** Read as a Pulumi secret; runtime env only, never a build arg. */
	secret?: boolean;
};

export const APP_ENV_VARS: AppEnvVar[] = [
	// Client vars (apps/web/src/env.ts `client`) — baked into the bundle at
	// build time. `PUBLIC_SERVER_URL` is empty for same-origin (Caddy routes
	// `/api/*` to the control plane); set it only for split-origin deploys.
	{ build: true, name: "PUBLIC_WEB_DOMAIN", source: "app" },
	{ build: true, name: "PUBLIC_WEB_PORT", source: "app" },
	{ build: true, name: "PUBLIC_WEB_SSL", source: "app" },
	{ build: true, name: "PUBLIC_SERVER_URL", optional: true, source: "app" },
	// Optional in apps/web/src/env.ts (commented out); injected only when configured.
	{ build: true, name: "PUBLIC_POSTHOG_KEY", optional: true, source: "app" },
	{ build: true, name: "PUBLIC_POSTHOG_HOST", optional: true, source: "app" },
	// Web SSR origin for the control plane (apps/web/src/env.ts `server`,
	// runtime-only). Always derived: the internal server container URL in
	// deployed stacks, `http://127.0.0.1:4000` by default in local dev
	// (see the `CONTROL_PLANE_URL` default in apps/web/src/env.ts).
	{ name: "CONTROL_PLANE_URL", source: "derived" },
	// Server vars (apps/server/src/env.ts) — runtime only, never build args.
	{ name: "AUTH_SECRET", secret: true, source: "app" },
	{ name: "GOOGLE_CLIENT_ID", secret: true, source: "app" },
	{ name: "GOOGLE_CLIENT_SECRET", secret: true, source: "app" },
	{ name: "GITHUB_CLIENT_ID", secret: true, source: "app" },
	{ name: "GITHUB_CLIENT_SECRET", secret: true, source: "app" },
	// Optional machine-server vars (dev defaults apply when unset).
	{ name: "MACHINE_CLIENT_ALLOWLIST", optional: true, source: "app" },
	{ name: "E2E_SEED", optional: true, source: "app" },
	{ name: "CORS_EXTRA_ORIGINS", optional: true, source: "app" },
	{ name: "DB_USER", secret: true, source: "postgres" },
	{ name: "DB_PASSWORD", secret: true, source: "postgres" },
	// Derived by the infra layer, not read from Pulumi config.
	{ name: "DB_HOST", source: "derived" },
	{ name: "DB_PORT", source: "derived" },
	{ name: "DB_SSL", source: "derived" },
];

/**
 * Build args for the image: non-secret vars the Dockerfile needs at build
 * time. Secrets are excluded so they can never be baked into image layers.
 */
export function appBuildArgs(
	envValues: Record<string, pulumi.Input<string>>,
): Record<string, pulumi.Input<string>> {
	return Object.fromEntries(
		APP_ENV_VARS.filter(({ build }) => build).map(({ name }) => {
			const value = envValues[name];
			if (value === undefined) {
				throw new Error(`Missing env value for ${name}`);
			}
			return [name, value];
		}),
	);
}

/** Runtime `envs` entries (`NAME=value`) for every manifest var. */
export function appRuntimeEnvs(
	envValues: Record<string, pulumi.Input<string>>,
): pulumi.Input<string>[] {
	return APP_ENV_VARS.map(
		({ name }) => pulumi.interpolate`${name}=${envValues[name]}`,
	);
}

/**
 * Runtime `envs` for the web (UI) container. The web bundle never sees
 * secrets: only the `PUBLIC_*` build vars plus the derived
 * `CONTROL_PLANE_URL` (internal control-plane origin for SSR) are injected.
 * The control plane (`server.ts`) gets the full `appRuntimeEnvs` set.
 */
export function webRuntimeEnvs(
	envValues: Record<string, pulumi.Input<string>>,
	derived: Record<string, pulumi.Input<string>> = {},
): pulumi.Input<string>[] {
	const names = [
		...APP_ENV_VARS.filter(({ build }) => build).map(({ name }) => name),
		"CONTROL_PLANE_URL",
	];
	return names.map((name) => {
		const value = derived[name] ?? envValues[name];
		return pulumi.interpolate`${name}=${value}`;
	});
}

export interface ConfigValue {
	secret?: boolean;
	value?: string | object;
}

/** `pulumi config --json` output or the in-program `allConfig()` record. */
export type PulumiConfig = Record<string, string | ConfigValue>;

function toEnvValue(entry: string | ConfigValue): string | undefined {
	if (typeof entry === "string") {
		return entry;
	}

	const { value } = entry;
	if (value === undefined) {
		return undefined;
	}

	return typeof value === "string" ? value : JSON.stringify(value);
}

export function extractEnv(
	config: PulumiConfig,
	namespace?: string,
): Record<string, string> {
	const env: Record<string, string> = {};

	for (const [key, entry] of Object.entries(config)) {
		const separator = key.indexOf(":");
		const keyNamespace = separator === -1 ? "" : key.slice(0, separator);
		if (namespace !== undefined && keyNamespace !== namespace) {
			continue;
		}

		const name = separator === -1 ? key : key.slice(separator + 1);
		const value = toEnvValue(entry);
		if (!name || value === undefined) {
			continue;
		}

		env[name] = value;
	}

	return Object.fromEntries(
		Object.entries(env).sort(([a], [b]) => a.localeCompare(b)),
	);
}

/**
 * Resolve every manifest var to a container env value: derived overrides
 * first, then the Pulumi config namespace named by the var's `source`.
 * Secrets resolve through `requireSecret`, optional vars through `get` (empty
 * string when unset).
 */
export function appEnvValues(
	configs: { app: pulumi.Config; postgres: pulumi.Config },
	derived: Record<string, pulumi.Input<string>> = {},
): Record<string, pulumi.Input<string>> {
	return Object.fromEntries(
		APP_ENV_VARS.map(({ name, source, secret, optional }) => {
			const derivedValue = derived[name];
			if (derivedValue !== undefined) return [name, derivedValue];

			const cfg = source === "postgres" ? configs.postgres : configs.app;
			const raw = optional
				? cfg.get(name)
				: secret
					? cfg.requireSecret(name)
					: cfg.require(name);
			return [
				name,
				raw === undefined ? "" : pulumi.output(raw).apply((v) => String(v)),
			];
		}),
	);
}
