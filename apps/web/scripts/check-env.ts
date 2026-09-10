/**
 * Drift check for environment wiring.
 *
 * Env vars appear in three places that must stay in sync:
 *
 *   1. infra/utils/extract-env.ts — the manifest (single source of truth)
 *   2. Dockerfile          — `ARG` declarations for build-time vars
 *   3. src/env.ts          — T3Env validation keys
 *
 * Fails when the Dockerfile build args or the validated keys drift from the
 * manifest. Run with: bun run scripts/check-env.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { APP_ENV_VARS } from "../infra/utils/extract-env.ts";

const root = resolve(import.meta.dir, "..");
const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
const envTs = readFileSync(resolve(root, "src/env.ts"), "utf8");

const problems: string[] = [];

// Every build var needs a matching `ARG` in the Dockerfile — and vice versa.
const dockerArgs = [...dockerfile.matchAll(/^ARG\s+([A-Z0-9_]+)\s*$/gm)].map(
	(match) => match[1],
);
const buildVars = APP_ENV_VARS.filter((v) => v.build).map((v) => v.name);

for (const name of buildVars) {
	if (!dockerArgs.includes(name)) {
		problems.push(
			`Dockerfile: no ARG ${name} for build var in infra/utils/extract-env.ts`,
		);
	}
}
for (const name of dockerArgs) {
	if (!buildVars.includes(name)) {
		problems.push(
			`Dockerfile: ARG ${name} is not a build var in infra/utils/extract-env.ts`,
		);
	} else if (!dockerfile.includes(`$${name}`)) {
		problems.push(`Dockerfile: ARG ${name} is never consumed by an ENV`);
	}
}

// Secrets must never be build args — they would be baked into image layers.
for (const { name, build, secret } of APP_ENV_VARS) {
	if (build && secret) {
		problems.push(`env manifest: ${name} is both a build arg and a secret`);
	}
}

// Every key validated in src/env.ts must be provided by the manifest.
const validatedKeys = [...envTs.matchAll(/^\t\t([A-Z0-9_]+):/gm)].map(
	(match) => match[1],
);
for (const key of validatedKeys) {
	if (!APP_ENV_VARS.some((v) => v.name === key)) {
		problems.push(
			`src/env.ts: ${key} is validated but missing from infra/utils/extract-env.ts`,
		);
	}
}

if (problems.length > 0) {
	console.error(`env wiring drift (${problems.length}):`);
	for (const problem of problems) {
		console.error(`  - ${problem}`);
	}
	process.exit(1);
}

console.log(
	`env wiring ok: ${APP_ENV_VARS.length} vars, ${buildVars.length} build args, ${validatedKeys.length} validated keys`,
);
