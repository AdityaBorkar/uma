import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/settings/evals")({
	component: EvalsPage,
});

function EvalsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Evals</h1>
				<p className="text-muted-foreground text-sm">
					Placeholder — evals will live here.
				</p>
			</div>
			<div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm">
				No evals yet — evaluation results will be listed here.
			</div>
		</div>
	);
}
