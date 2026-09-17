import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

import { GROUP_LABELS } from "./utils.ts";

export function caddyContainer(
	{
		network,
		provider,
		server,
		web,
	}: {
		network: docker.Network;
		provider: docker.Provider;
		server: { container: docker.Container; port: pulumi.Input<number> };
		web: { container: docker.Container; port: pulumi.Input<number> };
	},
	{
		dependsOn,
	}: {
		dependsOn?: pulumi.Input<pulumi.Resource>[];
	},
) {
	const webUpstream = pulumi.interpolate`${web.container.name}:${web.port}`;
	const serverUpstream = pulumi.interpolate`${server.container.name}:${server.port}`;
	const appConfig = new pulumi.Config("app");

	const domain = appConfig.require("PUBLIC_WEB_DOMAIN");
	const publicPort = appConfig.requireNumber("PUBLIC_WEB_PORT");
	const ssl = appConfig.getBoolean("PUBLIC_WEB_SSL") ?? false;

	const site = ssl
		? pulumi.interpolate`https://${domain}`
		: pulumi.interpolate`http://${domain}:${publicPort}`;

	const caddyfile = pulumi.interpolate`# Managed by Pulumi
${site} {
	# Control plane (oRPC, auth, machine wire incl. WS, OAuth callbacks).
	handle /api/* {
		reverse_proxy ${serverUpstream}
	}
	# Product UI (TanStack Start).
	handle {
		reverse_proxy ${webUpstream}
	}
}
`;

	const image = new docker.RemoteImage(
		"caddy-image",
		{ name: "caddy:2-alpine" },
		{ provider },
	);

	const container = new docker.Container(
		"caddy-container",
		{
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
					"http://127.0.0.1:2019/config/",
				],
				timeout: "5s",
			},
			image: image.imageId,
			labels: GROUP_LABELS,
			networksAdvanced: [{ name: network.name }],
			ports: ssl
				? [
						{ external: publicPort, internal: 443 },
						{ external: 80, internal: 80 },
					]
				: [{ external: publicPort, internal: publicPort }],
			restart: "unless-stopped",
			uploads: [
				{
					content: caddyfile,
					file: "/etc/caddy/Caddyfile",
				},
			],
		},
		{ dependsOn, provider },
	);

	return { container };
}
