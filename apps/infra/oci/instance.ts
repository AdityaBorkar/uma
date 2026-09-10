import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

import * as local from "@pulumi/local";
import * as oci from "@pulumi/oci";
import * as pulumi from "@pulumi/pulumi";

import { displayName } from "./utils.ts";

export function createInstance({ subnet }: { subnet: oci.core.Subnet }) {
	const config = new pulumi.Config("vps");
	const compartmentId = config.require("compartmentId");
	const sshUser = config.require("sshUser");
	const sshPublicKey = config.requireSecret("sshPublicKey");
	const sshPrivateKey = config.requireSecret("sshPrivateKey");

	const keyFile = new local.File(
		"keyFileOutput",
		{
			content: pulumi.interpolate`${sshPrivateKey}\n`,
			filename: `${tmpdir()}/${randomBytes(6).toString("hex")}`,
			filePermission: "0600",
		},
		{ replaceOnChanges: ["*"] },
	);

	const ssh = {
		opts: keyFile.filename.apply((path) =>
			`-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -i ${path}`.split(
				" ",
			),
		),
		user: sshUser,
	};

	const image = oci.core
		.getImagesOutput({
			compartmentId,
			operatingSystem: "Canonical Ubuntu",
			operatingSystemVersion: "26.04",
			shape: "VM.Standard.A1.Flex",
			sortBy: "TIMECREATED",
			sortOrder: "DESC",
		})
		.apply((images) => images.images[0]);

	const instance = new oci.core.Instance(
		"vps-instance",
		{
			agentConfig: {
				areAllPluginsDisabled: true,
				isManagementDisabled: true,
				isMonitoringDisabled: true,
			},
			availabilityDomain: "tbvH:AP-MUMBAI-1-AD-1",
			compartmentId,
			createVnicDetails: {
				assignPublicIp: "false",
				subnetId: subnet.id,
			},
			displayName: displayName("vps-instance-compute"),
			metadata: {
				ssh_authorized_keys: sshPublicKey,
				sshAuthorizedKeys: sshPublicKey,
				user_data: Buffer.from(dockerCloudInit(ssh.user)).toString("base64"),
			},
			shape: "VM.Standard.A1.Flex",
			shapeConfig: {
				memoryInGbs: 6,
				ocpus: 1,
			},
			sourceDetails: {
				bootVolumeSizeInGbs: String(100),
				sourceId: image.id,
				sourceType: "image",
			},
		},
		{ replaceOnChanges: ["metadata"] },
	);

	return { instance, ssh };
}

function dockerCloudInit(sshUser: string): string {
	return `#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl gnupg

curl -fsSL https://get.docker.com | sh
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ${sshUser}
`;
}
