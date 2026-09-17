import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderCard } from "#/components/lists/PlaceholderCard.tsx";
import { PageHeader } from "#/components/lists/shared.tsx";

export const Route = createFileRoute("/(app)/settings/analytics")({
	component: AnalyticsPage,
	head: () => ({
		meta: [
			{ title: "Analytics — Planner" },
			{
				content: "Flow and cycle analytics for your projects.",
				name: "description",
			},
		],
	}),
});

function AnalyticsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				description="Placeholder — analytics will live here."
				title="Analytics"
			/>
			<PlaceholderCard>
				No analytics yet — analytics will live here.
			</PlaceholderCard>
		</div>
	);
}
