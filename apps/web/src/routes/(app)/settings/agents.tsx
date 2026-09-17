import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { RegistryStatusBadge } from "#/components/data/StatusBadge.tsx";
import {
	ListRow,
	ListRowActions,
	ListRowMain,
	ListRowSubtitle,
	ListRowTitle,
} from "#/components/lists/ListRow.tsx";
import {
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { rpc } from "#/lib/rpc.ts";
import { invalidateAgents } from "#/stores/invalidation.ts";

export const Route = createFileRoute("/(app)/settings/agents")({
	component: AgentsPage,
	head: () => ({
		meta: [
			{ title: "Agents — Planner" },
			{
				content: "Coding agents that can run tasks on your machines.",
				name: "description",
			},
		],
	}),
});

function AgentsPage() {
	const queryClient = useQueryClient();
	const agentsQuery = useQuery(
		rpc.agents.list.queryOptions({ input: undefined }),
	);
	const removeMutation = useMutation(
		rpc.agents.remove.mutationOptions({
			onSuccess: () => invalidateAgents(queryClient),
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
							<ListRow key={a.id}>
								<ListRowMain>
									<ListRowTitle mono={true}>{a.name}</ListRowTitle>
									<ListRowSubtitle>
										{a.description ?? "Custom agent."}
										{a.binary && a.binary !== a.name
											? ` · runs ${a.binary}`
											: ""}
										{a.version ? ` · ${a.version}` : ""}
									</ListRowSubtitle>
								</ListRowMain>
								<ListRowActions>
									<RegistryStatusBadge
										danger={["deprecated"]}
										status={a.status}
										success={["available"]}
									/>
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
								</ListRowActions>
							</ListRow>
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
