import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "#/components/ui/badge.tsx";
import { Card } from "#/components/ui/card.tsx";

export const Route = createFileRoute("/(app)/settings/agents")({
	component: AgentsPage,
});

const AGENTS = [
	{
		description: "AI coding agent for terminal and automation.",
		name: "opencode",
		status: "supported",
	},
	{
		description: "Lightweight interactive coding agent.",
		name: "pi",
		status: "supported",
	},
	{
		description: "Multi-agent orchestrator.",
		name: "omp",
		status: "supported",
	},
] as const;

function AgentsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Agents</h1>
				<p className="text-muted-foreground text-sm">
					Coding agents that can run on your machines.
				</p>
			</div>

			<Card className="overflow-hidden p-0">
				<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
					<span className="font-semibold">{AGENTS.length} agents</span>
					<span className="text-muted-foreground">· supported</span>
				</div>
				<div>
					{AGENTS.map((a) => (
						<div
							className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
							key={a.name}
						>
							<div className="min-w-0">
								<p className="font-mono font-semibold text-sm">{a.name}</p>
								<p className="text-muted-foreground text-sm">{a.description}</p>
							</div>
							<Badge
								className="shrink-0 self-start sm:self-center"
								variant="success"
							>
								{a.status}
							</Badge>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
