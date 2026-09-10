import net from "node:net";
import { resolve } from "node:path";

import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import { getProject, interpolate } from "@pulumi/pulumi";

import {
	appBuildArgs,
	appEnvValues,
	appRuntimeEnvs,
} from "../utils/extract-env.ts";
import { GROUP_LABELS } from "./utils.ts";

/**
 * Pick a random port in the IANA dynamic range (49152–65535) and verify it is
 * free by actually binding to it on the machine running `pulumi up`. That is
 * authoritative for a local docker daemon; for a remote daemon it is a best-
 * effort check (the container port is internal-only anyway, reachable solely
 * through the shared docker network).
 */
async function findFreePort(attempts = 10): Promise<number> {
	for (let i = 0; i < attempts; i++) {
		const port = 49152 + Math.floor(Math.random() * (65535 - 49152 + 1));
		const free = await new Promise<boolean>((resolve) => {
			const server = net.createServer();
			server.once("error", () => resolve(false));
			server.listen(port, "0.0.0.0", () => server.close(() => resolve(true)));
		});
		if (free) return port;
	}
	throw new Error(`no free port found after ${attempts} attempts`);
}

export async function appContainer({
	network,
	provider,
	postgres,
}: {
	network: docker.Network;
	provider: docker.Provider;
	postgres: { container: docker.Container };
}) {
	const appPort = await findFreePort();

	const config = new pulumi.Config("app");
	const postgresConfig = new pulumi.Config("postgres");

	// Values resolved from the env manifest in ../utils/extract-env.ts.
	// DB_HOST/DB_PORT/DB_SSL are derived here: the container reaches Postgres
	// on the shared Docker network by container name, on the fixed in-network
	// port, without TLS.
	const envValues = appEnvValues(
		{ app: config, postgres: postgresConfig },
		{
			DB_HOST: postgres.container.name,
			DB_PORT: "5432",
			DB_SSL: "false",
		},
	);

	const buildArgs = appBuildArgs(envValues);

	// Timings are wall-clock on the machine running `pulumi up`, so for remote
	// daemons they include streaming the build context over SSH.
	const imageBuildStartedAt = Date.now();
	const image = new docker.Image(
		"app-image",
		{
			build: {
				args: buildArgs,
				context: resolve(import.meta.dir, "../.."),
				dockerfile: resolve(import.meta.dir, "../../Dockerfile"),
				platform: "linux/arm64",
			},
			imageName: interpolate`${getProject()}-app:latest`,
			skipPush: true,
		},
		{ provider },
	);
	const imageBuildMs = Date.now() - imageBuildStartedAt;

	// repoDigest is the local image ID and changes on every rebuild, so the
	// container is recreated whenever the image changes. Fall back to the tag
	// if the provider ever returns an empty digest.
	const containerImage = pulumi
		.all([image.repoDigest, image.imageName])
		.apply(([digest, name]) => digest || name);

	const containerCreateStartedAt = Date.now();
	const container = new docker.Container(
		"app-container",
		{
			envs: [
				"NODE_ENV=production",
				"HOST=0.0.0.0",
				`PORT=${appPort}`,
				...appRuntimeEnvs(envValues),
			],
			healthcheck: {
				interval: "30s",
				retries: 3,
				startPeriod: "15s",
				tests: [
					"CMD",
					"wget",
					"-q",
					"-O",
					"/dev/null",
					`http://127.0.0.1:${appPort}/health`,
				],
				timeout: "5s",
			},
			image: containerImage,
			labels: GROUP_LABELS,
			networksAdvanced: [{ name: network.name }],
			restart: "unless-stopped",
		},
		{ provider },
	);

	return {
		container,
		image,
		// Consumed by index.ts and exported as stack outputs for the GitHub
		// Actions deploy summary. Deliberately secret-free — only names,
		// digests, ports and durations. On `preview` the numbers are ~0.
		metrics: {
			containerCreateMs: Date.now() - containerCreateStartedAt,
			containerName: container.name,
			imageBuildMs,
			imageDigest: image.repoDigest,
			imageName: image.imageName,
		},
		// Internal listen port (consumed by caddy's reverse_proxy upstream);
		// the externally published port is PUBLIC_WEB_PORT on the caddy
		// container.
		port: appPort,
	};
}
