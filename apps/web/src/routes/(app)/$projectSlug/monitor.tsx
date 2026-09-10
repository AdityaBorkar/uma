import { createFileRoute } from "@tanstack/react-router";

import { useWorkspace } from "#/components/workspace.tsx";

export const Route = createFileRoute("/(app)/$projectSlug/monitor")({
	component: RouteComponent,
});

function RouteComponent() {
	const ws = useWorkspace();
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Monitor</h1>
				<p className="text-muted-foreground text-sm">
					{ws.isMulti
						? "Live system status and recent activity — all projects."
						: `${ws.project.name} — live status for this project.`}
				</p>
			</div>
			<div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm">
				Monitor view coming soon — signals and task health will appear here.
			</div>
		</div>
	);
}
