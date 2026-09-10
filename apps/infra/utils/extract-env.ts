/**
 * Environment-variable wiring for the Pulumi layer, in one place.
 *
 * `APP_ENV_VARS` is the single source of truth for the app container's
 * environment variables. Every var the app reads (see `src/env.ts`) is
 * declared here exactly once; `appEnvValues` (consumed by
 * `infra/docker/app.ts`) derives both the Docker build args and the runtime
 * container envs from this manifest, and `scripts/check-env.ts` verifies the
 * Dockerfile build args and the `src/env.ts` validation keys against it.
 *
 * `extractEnv` flattens Pulumi stack config into a plain `name -> value` map.
 * Its consumer is `infra/utils/run-command.ts`, which parses
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
	// Client vars (src/env.ts `client`) — baked into the bundle at build time.
	{ build: true, name: "PUBLIC_WEB_DOMAIN", source: "app" },
	{ build: true, name: "PUBLIC_WEB_PORT", source: "app" },
	{ build: true, name: "PUBLIC_WEB_SSL", source: "app" },
	// Optional in src/env.ts (commented out); injected only when configured.
	{ build: true, name: "PUBLIC_POSTHOG_KEY", optional: true, source: "app" },
	{ build: true, name: "PUBLIC_POSTHOG_HOST", optional: true, source: "app" },
	// Server vars (src/env.ts `server`) — runtime only, never build args.
	{ name: "AUTH_SECRET", secret: true, source: "app" },
	{ name: "GOOGLE_CLIENT_ID", secret: true, source: "app" },
	{ name: "GOOGLE_CLIENT_SECRET", secret: true, source: "app" },
	{ name: "GITHUB_CLIENT_ID", secret: true, source: "app" },
	{ name: "GITHUB_CLIENT_SECRET", secret: true, source: "app" },
	// Optional machine-server vars (dev defaults apply when unset).
	{ name: "MACHINE_CLIENT_ALLOWLIST", optional: true, source: "app" },
	{ name: "E2E_SEED", optional: true, source: "app" },
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
		APP_ENV_VARS.filter(({ build }) => build).map(({ name }) => [
			name,
			envValues[name],
		]),
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
