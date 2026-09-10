import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { MonitorSmartphone } from "#/components/icons.tsx";
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

export const Route = createFileRoute("/(app)/settings/machines")({
	component: MachinesPage,
});

function statusVariant(status: string): "success" | "outline" | "destructive" {
	if (status === "connected") return "success";
	if (status === "revoked") return "destructive";
	return "outline";
}

function MachinesPage() {
	const queryClient = useQueryClient();
	const machinesQuery = useQuery(rpc.machines.list.queryOptions());
	const revokeMutation = useMutation(
		rpc.machines.revoke.mutationOptions({
			onSuccess: () =>
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.machines.list.key()),
				}),
		}),
	);

	const items = machinesQuery.data ?? [];

	return (
		<div className="space-y-4">
			<PageHeader
				action={
					<Button asChild={true} variant="primary">
						<Link to="/device">New machine</Link>
					</Button>
				}
				description="Devices that can run agents on your behalf."
				title="Remote Machines"
			/>

			{machinesQuery.isPending ? (
				<ListLoadingCard label="Loading machines…" />
			) : machinesQuery.isError ? (
				<ListErrorAlert
					error={machinesQuery.error}
					onRetry={() => void machinesQuery.refetch()}
					title="Failed to load machines"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button asChild={true} className="mt-4" variant="primary">
							<Link to="/device">Connect a machine</Link>
						</Button>
					}
					description="Connect a device to run agents remotely. Each machine will show its name, connection state, and last heartbeat here."
					title="No remote machines yet"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{items.length} machines</span>
							<span className="text-muted-foreground">· all</span>
						</>
					}
				>
					<div>
						{items.map((m) => (
							<div
								className="flex flex-col gap-3 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={m.id}
							>
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<p className="truncate font-semibold text-sm">{m.name}</p>
										<p className="text-muted-foreground text-xs">
											{m.cliVersion ? `cli ${m.cliVersion} · ` : ""}
											{m.lastSeenAt
												? `last seen ${new Date(m.lastSeenAt).toLocaleString("en-US", { timeZone: "UTC" })}`
												: "never seen"}
										</p>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<Badge variant={statusVariant(m.status)}>{m.status}</Badge>
									{m.status !== "revoked" ? (
										<Button
											disabled={revokeMutation.isPending}
											onClick={() => revokeMutation.mutate({ id: m.id })}
											size="sm"
											type="button"
											variant="destructive"
										>
											Revoke
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
					To enroll a device, run{" "}
					<code className="font-mono text-xs">uma-machine enroll</code> on it,
					then approve the shown code at{" "}
					<Link className="underline" to="/device">
						/device
					</Link>
					.
				</CardContent>
			</Card>
		</div>
	);
}
