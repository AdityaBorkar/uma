import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/settings/commands")({
	beforeLoad: () => {
		throw redirect({
			to: "/settings/prompt-templates",
		});
	},
});
