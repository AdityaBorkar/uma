import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderCard } from "#/components/lists/PlaceholderCard.tsx";
import { PageHeader } from "#/components/lists/shared.tsx";
import { useScopeSubtitle } from "#/lib/lists.ts";

export const Route = createFileRoute("/(app)/$projectSlug/automations")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Automations — Planner" },
			{
				content: "Automated workflows and rules for this scope.",
				name: "description",
			},
		],
	}),
});

function RouteComponent() {
	const subtitle = useScopeSubtitle("automated workflows for this scope.");
	return (
		<div className="space-y-6">
			<PageHeader description={subtitle} title="Automations" />
			<PlaceholderCard>
				Automations view coming soon — automated workflows will appear here.
			</PlaceholderCard>
		</div>
	);
}
