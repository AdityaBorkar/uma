import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderCard } from "#/components/lists/PlaceholderCard.tsx";
import { PageHeader } from "#/components/lists/shared.tsx";
import { useScopeSubtitle } from "#/lib/lists.ts";

export const Route = createFileRoute("/(app)/$projectSlug/releases")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "Releases — Planner" },
			{
				content: "Package and publish releases for this scope.",
				name: "description",
			},
		],
	}),
});

function RouteComponent() {
	const subtitle = useScopeSubtitle("releases for this scope.");
	return (
		<div className="space-y-6">
			<PageHeader description={subtitle} title="Releases" />
			<PlaceholderCard>
				Releases view coming soon — packaged releases will appear here.
			</PlaceholderCard>
		</div>
	);
}
