import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderCard } from "#/components/lists/PlaceholderCard.tsx";
import { PageHeader } from "#/components/lists/shared.tsx";
import { useScopeSubtitle } from "#/lib/lists.ts";

export const Route = createFileRoute("/(app)/$projectSlug/monitor")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Monitor — Planner" },
			{
				content: "Live system status and recent activity for this scope.",
				name: "description",
			},
		],
	}),
});

function RouteComponent() {
	const subtitle = useScopeSubtitle("live status for this scope.");
	return (
		<div className="space-y-6">
			<PageHeader description={subtitle} title="Monitor" />
			<PlaceholderCard>
				Monitor view coming soon — task health will appear here.
			</PlaceholderCard>
		</div>
	);
}
