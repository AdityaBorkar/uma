import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/settings/")({
	beforeLoad: () => {
		throw redirect({
			to: "/settings/account",
		});
	},
});
