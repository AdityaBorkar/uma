import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

import { PROJECT_ID } from "../docker/utils.ts";

export function configureDns(
	{ publicIp }: { publicIp: string | pulumi.Output<string> },
	{ dependsOn }: { dependsOn: pulumi.Input<pulumi.Resource>[] },
) {
	const config = new pulumi.Config("cf");
	const domainName = config.require("domain");
	const zoneId = config.require("zoneId");

	const dns = new cloudflare.DnsRecord(
		"dns-a",
		{
			comment: pulumi.interpolate`managed-by pulumi (${PROJECT_ID})`,
			content: publicIp,
			name: domainName,
			proxied: true,
			ttl: 1,
			type: "A",
			zoneId,
		},
		{ dependsOn },
	);

	return { dns };
}
