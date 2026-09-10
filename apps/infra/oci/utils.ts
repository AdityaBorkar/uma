import * as pulumi from "@pulumi/pulumi";

import { PROJECT_ID } from "../docker/utils.ts";

/**
 * OCI resource displayName: `<PROJECT_ID>-<name>-<description>`.
 *
 * OCI names everything inside the tenancy, so each resource is labeled with
 * the Pulumi project + stack first to make costs/API-listing traceable.
 */
export function displayName(name: string): pulumi.Output<string> {
	return pulumi.interpolate`${PROJECT_ID}-${name}`;
}
