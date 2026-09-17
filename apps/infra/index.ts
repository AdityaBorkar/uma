import * as docker from "@pulumi/docker";
import { all, getStack, interpolate, output } from "@pulumi/pulumi";

import { configureDns } from "./cloudflare/dns.ts";
import { caddyContainer } from "./docker/caddy.ts";
import { postgresContainer } from "./docker/postgres.ts";
import { serverContainer } from "./docker/server.ts";
import { GROUP_LABELS } from "./docker/utils.ts";
import { waitForDocker } from "./docker/wait-for-docker.ts";
import { webContainer } from "./docker/web.ts";
import { createInstance } from "./oci/instance.ts";
import { createNetwork } from "./oci/networking.ts";
import { attachReservedPublicIp } from "./oci/public-ip.ts";

// --- PROVISION INSTANCE ---

export async function vpsInstance() {
	const { subnet } = createNetwork();
	const { instance, ssh } = createInstance({ subnet });
	const { publicIp } = attachReservedPublicIp({ instance });
	const host = interpolate`ssh://${ssh.user}@${publicIp.ipAddress}`;
	return { instance, publicIp, ssh: { host, ...ssh } };
}

const vps = getStack() === "dev" ? undefined : await vpsInstance();

// --- PROVISION STORAGE ---

// s3

// --- DOCKER ---

const runStartedAt = Date.now();
const sshOpts = vps?.ssh.opts;
const host = vps
	? all([vps.ssh.host, vps.ssh.opts]).apply(async ([host, sshOpts]) => {
			await waitForDocker(host, { sshOpts, timeoutMs: 100_000 });
			return host;
		})
	: output("unix:///var/run/docker.sock").apply(async (host) => {
			await waitForDocker(host, { timeoutMs: 30_000 });
			return host;
		});

const provider = new docker.Provider(
	"docker",
	{ host, sshOpts },
	{ ...(vps ? { dependsOn: [vps.instance] } : {}) },
);

const network = new docker.Network(
	"docker-network",
	{ driver: "bridge", labels: GROUP_LABELS },
	{ provider },
);

const postgres = postgresContainer({ network, provider });

// TODO: Enable DB Backups
// const backends = vps ? createBackupBackend() : undefined;

// TODO: Run Database Migrations

let webMetrics: Awaited<ReturnType<typeof webContainer>>["metrics"] | undefined;
let serverMetrics:
	| Awaited<ReturnType<typeof serverContainer>>["metrics"]
	| undefined;

if (vps) {
	const server = await serverContainer({ network, postgres, provider });
	serverMetrics = server.metrics;

	const web = await webContainer({ network, provider, server });
	webMetrics = web.metrics;

	caddyContainer(
		{ network, provider, server, web },
		{ dependsOn: [web.container, server.container] },
	);
}

// --- DNS RECORDS ---

if (vps) {
	configureDns(
		{ publicIp: vps.publicIp.ipAddress },
		{ dependsOn: [vps.instance] },
	);
}

// --- METRICS (stack outputs) ---

export const metrics = {
	postgres: postgres.metrics,
	server: serverMetrics ?? null,
	totalMs: Date.now() - runStartedAt,
	web: webMetrics ?? null,
};
