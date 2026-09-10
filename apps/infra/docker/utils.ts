import { getProject, getStack, interpolate } from "@pulumi/pulumi";

export const PROJECT_ID = interpolate`${getProject()}-${getStack()}`;

export const GROUP_LABELS = [
	{
		label: "com.docker.compose.project",
		value: PROJECT_ID,
	},
	{ label: "managed-by", value: "pulumi" },
];
