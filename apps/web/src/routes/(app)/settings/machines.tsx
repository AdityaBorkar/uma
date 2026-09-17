import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RegistryStatusBadge } from "#/components/data/StatusBadge.tsx";
import { MonitorSmartphone } from "#/components/icons.tsx";
import {
	ListRow,
	ListRowActions,
	ListRowMain,
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
import { invalidateMachines } from "#/stores/invalidation.ts";

export const Route = createFileRoute("/(app)/settings/machines")({
	component: MachinesPage,
	head: () => ({
		meta: [
			{ title: "Remote Machines — Planner" },
			{
				content: "Connect and manage machines that run agents on your behalf.",
				name: "description",
			},
		],
	}),
});

interface MachineRow {
	cliVersion: string | null;
	id: string;
	lastSeenAt: string | Date | null;
	name: string;
	status: string;
}

function toMachineRow(item: Record<string, unknown>): MachineRow | null {
	if (typeof item.id !== "string") {
		return null;
	}
	if (typeof item.name !== "string") {
		return null;
	}
	if (typeof item.status !== "string") {
		return null;
	}
	const cliVersion =
		typeof item.cliVersion === "string" ? item.cliVersion : null;
	const lastSeenRaw = item.lastSeenAt;
	const lastSeenAt =
		lastSeenRaw === null || lastSeenRaw === undefined || lastSeenRaw === ""
			? null
			: typeof lastSeenRaw === "string" || lastSeenRaw instanceof Date
				? lastSeenRaw
				: null;
	if (
		lastSeenRaw !== null &&
		lastSeenRaw !== undefined &&
		lastSeenRaw !== "" &&
		lastSeenAt === null
	) {
		return null;
	}
	return {
		cliVersion,
		id: item.id,
		lastSeenAt,
		name: item.name,
		status: item.status,
	};
}

function MachinesPage() {
	const queryClient = useQueryClient();
	const machinesQuery = useQuery(rpc.machines.list.queryOptions());
	const revokeMutation = useMutation(
		rpc.machines.revoke.mutationOptions({
			onSuccess: () => invalidateMachines(queryClient),
		}),
	);

	const items = (machinesQuery.data ?? [])
		.map((item) => toMachineRow(item as Record<string, unknown>))
		.filter((row): row is MachineRow => row !== null);

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
							<ListRow className="gap-3" key={m.id}>
								<ListRowMain className="flex min-w-0 flex-1 items-center gap-2">
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
								</ListRowMain>
								<ListRowActions>
									<RegistryStatusBadge
										danger={["revoked"]}
										status={m.status}
										success={["connected"]}
									/>
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
								</ListRowActions>
							</ListRow>
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
