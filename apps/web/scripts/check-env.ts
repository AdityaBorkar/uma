import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Verifies the PUBLIC_* build-time wiring stays in sync across its three
// sources (manifest is the single source of truth):
//   1. apps/infra/utils/extract-env.ts — APP_ENV_VARS entries with build: true
//   2. apps/web/Dockerfile — ARG block (baked into the bundle at build time)
//   3. apps/web/src/env.ts — client vars validated at runtime
// Rules: Dockerfile ARGs must equal the manifest build set exactly; every
// manifest build var must be PUBLIC_*; every env.ts client var must be in the
// manifest; manifest build vars absent from env.ts must be optional (their
// validation is commented out, injected only when configured).

const WEB_DIR = resolve(import.meta.dir, "..");
const ROOT_DIR = resolve(WEB_DIR, "..", "..");

const DOCKERFILE = resolve(WEB_DIR, "Dockerfile");
const MANIFEST = resolve(ROOT_DIR, "apps/infra/utils/extract-env.ts");
const ENV_TS = resolve(WEB_DIR, "src/env.ts");

function dockerArgs(text: string): Set<string> {
	const args = new Set<string>();
	for (const line of text.split("\n")) {
		const name = line.match(/^\s*ARG\s+([A-Z0-9_]+)/)?.[1];
		if (name !== undefined) args.add(name);
	}
	return args;
}

function manifestBuildVars(text: string): {
	build: Set<string>;
	optionalBuild: Set<string>;
} {
	const build = new Set<string>();
	const optionalBuild = new Set<string>();
	for (const line of text.split("\n")) {
		if (!line.includes("build: true")) continue;
		const name = line.match(/name:\s*"([^"]+)"/)?.[1];
		if (name === undefined) continue;
		build.add(name);
		if (line.includes("optional: true")) optionalBuild.add(name);
	}
	return { build, optionalBuild };
}

function envClientVars(text: string): Set<string> {
	const vars = new Set<string>();
	for (const line of text.split("\n")) {
		if (line.trim().startsWith("//")) continue;
		const name = line.match(/^\s*(PUBLIC_[A-Z0-9_]+)\s*:/)?.[1];
		if (name !== undefined) vars.add(name);
	}
	return vars;
}

function diff(a: Set<string>, b: Set<string>): string[] {
	return [...a].filter((v) => !b.has(v)).sort((x, y) => x.localeCompare(y));
}

function main(): void {
	const docker = dockerArgs(readFileSync(DOCKERFILE, "utf8"));
	const { build, optionalBuild } = manifestBuildVars(
		readFileSync(MANIFEST, "utf8"),
	);
	const client = envClientVars(readFileSync(ENV_TS, "utf8"));

	const errors: string[] = [];
	for (const name of diff(build, docker)) {
		errors.push(
			`manifest build var missing from Dockerfile ARG block: ${name}`,
		);
	}
	for (const name of diff(docker, build)) {
		errors.push(`Dockerfile ARG has no manifest build: true entry: ${name}`);
	}
	for (const name of build) {
		if (!name.startsWith("PUBLIC_")) {
			errors.push(`manifest build var must be PUBLIC_*: ${name}`);
		}
	}
	for (const name of diff(client, build)) {
		errors.push(`env.ts client var missing from manifest: ${name}`);
	}
	for (const name of diff(build, client)) {
		if (!optionalBuild.has(name)) {
			errors.push(
				`manifest build var not in env.ts client must be optional: ${name}`,
			);
		}
	}

	if (errors.length > 0) {
		for (const error of errors) console.error(`check-env: ${error}`);
		process.exit(1);
	}
	console.log(
		`check-env: ok (${build.size} build vars in sync across manifest, Dockerfile, env.ts)`,
	);
}

main();
