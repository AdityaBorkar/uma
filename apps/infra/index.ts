import * as docker from "@pulumi/docker";
import { all, getStack, interpolate, output } from "@pulumi/pulumi";

import { configureDns } from "./cloudflare/dns.ts";
import { appContainer } from "./docker/app.ts";
import { caddyContainer } from "./docker/caddy.ts";
import { postgresContainer } from "./docker/postgres.ts";
import { GROUP_LABELS } from "./docker/utils.ts";
import { waitForDocker } from "./docker/wait-for-docker.ts";
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
	{ dependsOn: vps ? [vps.instance] : undefined },
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

let appMetrics: Awaited<ReturnType<typeof appContainer>>["metrics"] | undefined;

if (vps) {
	const app = await appContainer({ network, postgres, provider });
	appMetrics = app.metrics;

	caddyContainer({ app, network, provider }, { dependsOn: [app.container] });
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
	app: appMetrics ?? null,
	postgres: postgres.metrics,
	totalMs: Date.now() - runStartedAt,
};
