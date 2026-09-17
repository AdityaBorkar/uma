import net from "node:net";
import { resolve } from "node:path";

import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import { getProject, interpolate } from "@pulumi/pulumi";

import {
	appBuildArgs,
	appEnvValues,
	webRuntimeEnvs,
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

export async function webContainer({
	network,
	provider,
	server,
}: {
	network: docker.Network;
	provider: docker.Provider;
	/** Control plane (consumed for the derived `CONTROL_PLANE_URL`). */
	server: { container: docker.Container; port: pulumi.Input<number> };
}) {
	const webPort = await findFreePort();

	const config = new pulumi.Config("app");
	const postgresConfig = new pulumi.Config("postgres");

	// Values resolved from the env manifest in ../utils/extract-env.ts.
	// The web container is secret-free: only `PUBLIC_*` build vars plus the
	// derived `CONTROL_PLANE_URL` (internal server origin for SSR) reach it.
	const envValues = appEnvValues({ app: config, postgres: postgresConfig });

	const buildArgs = appBuildArgs(envValues);

	const controlPlaneUrl = pulumi.interpolate`http://${server.container.name}:${server.port}`;

	// Timings are wall-clock on the machine running `pulumi up`, so for remote
	// daemons they include streaming the build context over SSH.
	const imageBuildStartedAt = Date.now();
	const image = new docker.Image(
		"web-image",
		{
			build: {
				args: buildArgs,
				// Repo-root context: apps/web/Dockerfile copies the root
				// manifest (package.json/bun.lockb/bunfig.toml) and builds the
				// @uma/web workspace, so the context must be the repo root
				// (where Pulumi.yaml lives).
				context: resolve(import.meta.dir, "../../../"),
				dockerfile: resolve(import.meta.dir, "../../../apps/web/Dockerfile"),
				platform: "linux/arm64",
			},
			imageName: interpolate`${getProject()}-web:latest`,
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
		"web-container",
		{
			envs: [
				"NODE_ENV=production",
				"HOST=0.0.0.0",
				`PORT=${webPort}`,
				...webRuntimeEnvs(envValues, {
					CONTROL_PLANE_URL: controlPlaneUrl,
				}),
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
					`http://127.0.0.1:${webPort}/`,
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
		port: webPort,
	};
}
