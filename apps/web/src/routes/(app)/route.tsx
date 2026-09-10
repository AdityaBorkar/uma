import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getServerSession } from "#/rpc/session.ts";

export const Route = createFileRoute("/(app)")({
	beforeLoad: async ({ location }) => {
		const data = await getServerSession();
		if (!data) {
			throw redirect({
				search: { redirect: location.href },
				to: "/",
			});
		}
		return data;
	},
	component: AppLayout,
});

function AppLayout() {
	return <Outlet />;
}
