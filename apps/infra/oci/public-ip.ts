import * as oci from "@pulumi/oci";
import * as pulumi from "@pulumi/pulumi";

import { displayName } from "./utils.ts";

export function attachReservedPublicIp({
	instance,
}: {
	instance: oci.core.Instance;
}) {
	const config = new pulumi.Config("vps");
	const compartmentId = config.require("compartmentId");

	const { vnicAttachments } = oci.core.getVnicAttachmentsOutput({
		compartmentId,
		instanceId: instance.id,
	});

	const vnicId = vnicAttachments.apply((attachments) => {
		if (attachments.length === 0) {
			throw new Error(
				"Instance has no VNIC attachment yet — re-run `pulumi up` to finish assigning the reserved public IP",
			);
		}
		return attachments[0].vnicId;
	});

	const { privateIps } = oci.core.getPrivateIpsOutput({ vnicId });

	const privateIpId = privateIps.apply((ips) => {
		const primary = ips.find((ip) => ip.isPrimary);
		if (!primary) {
			throw new Error(
				"Primary private IP not found on the VNIC — re-run `pulumi up` to finish assigning the reserved public IP",
			);
		}
		return primary.id;
	});

	const publicIp = new oci.core.PublicIp(
		"vps-public-ip",
		{
			compartmentId,
			displayName: displayName("vps-public-ip-reserved"),
			lifetime: "RESERVED",
			privateIpId,
		},
		{ dependsOn: [instance] },
	);

	return { publicIp };
}
