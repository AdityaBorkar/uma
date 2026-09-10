import * as oci from "@pulumi/oci";
import * as pulumi from "@pulumi/pulumi";

import { displayName } from "./utils.ts";

export function createNetwork() {
	const config = new pulumi.Config("vps");
	const compartmentId = config.require("compartmentId");

	const vcn = new oci.core.Vcn("vps-vcn", {
		cidrBlocks: ["10.0.0.0/16"],
		compartmentId,
		displayName: displayName("vps-vcn-network"),
	});

	const igw = new oci.core.InternetGateway("vps-internet-gateway", {
		compartmentId,
		displayName: displayName("vps-internet-gateway-egress"),
		enabled: true,
		vcnId: vcn.id,
	});

	const routeTable = new oci.core.RouteTable("vps-route-table", {
		compartmentId,
		displayName: displayName("vps-route-table-egress"),
		routeRules: [
			{
				destination: "0.0.0.0/0",
				destinationType: "CIDR_BLOCK",
				networkEntityId: igw.id,
			},
		],
		vcnId: vcn.id,
	});

	const securityList = new oci.core.SecurityList("vps-security-list", {
		compartmentId,
		displayName: displayName("vps-security-list-egress"),
		egressSecurityRules: [{ destination: "0.0.0.0/0", protocol: "all" }],
		ingressSecurityRules: [
			{
				protocol: "6",
				source: "0.0.0.0/0",
				tcpOptions: { max: 22, min: 22 },
			},
			{
				protocol: "6",
				source: "0.0.0.0/0",
				tcpOptions: { max: 443, min: 443 },
			},
			{
				protocol: "6",
				source: "0.0.0.0/0",
				tcpOptions: { max: 80, min: 80 },
			},
		],
		vcnId: vcn.id,
	});

	const subnet = new oci.core.Subnet("vps-subnet", {
		cidrBlock: "10.0.0.0/24",
		compartmentId,
		displayName: displayName("vps-subnet"),
		routeTableId: routeTable.id,
		securityListIds: [securityList.id],
		vcnId: vcn.id,
	});

	return { igw, routeTable, securityList, subnet, vcn };
}
