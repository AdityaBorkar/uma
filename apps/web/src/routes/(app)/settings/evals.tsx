import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderCard } from "#/components/lists/PlaceholderCard.tsx";
import { PageHeader } from "#/components/lists/shared.tsx";

export const Route = createFileRoute("/(app)/settings/evals")({
	component: EvalsPage,
	head: () => ({
		meta: [
			{ title: "Evals — Planner" },
			{
				content: "Agent evaluation results and scoring.",
				name: "description",
			},
		],
	}),
});

function EvalsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				description="Placeholder — evals will live here."
				title="Evals"
			/>
			<PlaceholderCard>
				No evals yet — evaluation results will be listed here.
			</PlaceholderCard>
		</div>
	);
}
