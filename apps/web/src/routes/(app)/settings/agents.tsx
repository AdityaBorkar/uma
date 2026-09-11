import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/settings/agents")({
	component: AgentsPage,
});

function statusVariant(status: string): "success" | "outline" | "destructive" {
	if (status === "available") return "success";
	if (status === "deprecated") return "destructive";
	return "outline";
}

function AgentsPage() {
	const queryClient = useQueryClient();
	const agentsQuery = useQuery(
		rpc.agents.list.queryOptions({ input: undefined }),
	);
	const removeMutation = useMutation(
		rpc.agents.remove.mutationOptions({
			onSuccess: () =>
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.agents.list.key()),
				}),
		}),
	);

	const items = agentsQuery.data ?? [];

	return (
		<div className="space-y-6">
			<PageHeader
				description="Coding agents that can run on your machines. Tasks pin one via the agent field."
				title="Agents"
			/>

			{agentsQuery.isPending ? (
				<ListLoadingCard label="Loading agents…" />
			) : agentsQuery.isError ? (
				<ListErrorAlert
					error={agentsQuery.error}
					onRetry={() => void agentsQuery.refetch()}
					title="Failed to load agents"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					description="No agents registered yet."
					title="No agents"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{items.length} agents</span>
						</>
					}
				>
					<div>
						{items.map((a) => (
							<div
								className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={a.id}
							>
								<div className="min-w-0">
									<p className="font-mono font-semibold text-sm">{a.name}</p>
									<p className="text-muted-foreground text-sm">
										{a.description ?? "Custom agent."}
										{a.binary && a.binary !== a.name
											? ` · runs ${a.binary}`
											: ""}
										{a.version ? ` · ${a.version}` : ""}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
									<Badge variant={statusVariant(a.status)}>{a.status}</Badge>
									{!["opencode", "pi", "omp"].includes(a.name) ? (
										<Button
											disabled={removeMutation.isPending}
											onClick={() => removeMutation.mutate({ id: a.id })}
											size="sm"
											type="button"
											variant="destructive"
										>
											Remove
										</Button>
									) : null}
								</div>
							</div>
						))}
					</div>
				</ListResultCard>
			)}

			<Card className="overflow-hidden p-0">
				<CardContent className="py-4 text-muted-foreground text-sm">
					Well-known agents (<code className="font-mono text-xs">opencode</code>
					, <code className="font-mono text-xs">pi</code>,{" "}
					<code className="font-mono text-xs">omp</code>) are seeded
					automatically. Register custom agents from the API (
					<code className="font-mono text-xs">POST /api/agents</code>); queue a
					task pinned to one via its{" "}
					<code className="font-mono text-xs">agent</code> field.
				</CardContent>
			</Card>
		</div>
	);
}
