import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useWorkspace } from "#/components/workspace.tsx";
import { formatAgo } from "#/lib/age.ts";
import { rpc } from "#/lib/rpc.ts";
import type { TaskStatus } from "#/schemas/schema.ts";

export const Route = createFileRoute("/(app)/$projectSlug/dashboard")({
	component: DashboardPage,
});

interface TaskRow {
	id: string;
	projectId: string | null;
	projectName: string | null;
	queuedAt: string | Date;
	startedAt: string | Date | null;
	status: string;
	title: string;
}

function TaskListCard({
	description,
	isLoading,
	isError,
	onRetry,
	rows,
	emptyCta,
	emptyHint,
	search,
	title,
}: {
	title: string;
	description: string;
	isLoading: boolean;
	isError: boolean;
	onRetry: () => void;
	rows?: TaskRow[];
	emptyCta: string;
	emptyHint: string;
	search: { status?: TaskStatus };
}) {
	const ws = useWorkspace();
	return (
		<Card className="overflow-hidden rounded-md border">
			<CardHeader className="border-b bg-muted/50 px-4 py-3">
				<div className="flex items-center justify-between">
					<CardTitle className="font-semibold text-sm">{title}</CardTitle>
					<Button asChild={true} size="sm" variant="outline">
						<Link
							params={{ projectSlug: ws.projectSlug }}
							search={search}
							to="/$projectSlug/tasks"
						>
							View all
						</Link>
					</Button>
				</div>
				<CardDescription className="text-xs">{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-0 p-0">
				{isLoading ? (
					<div className="space-y-2 p-3">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : isError ? (
					<p className="px-3 py-4 text-destructive text-sm">
						Failed to load.{" "}
						<button
							className="underline hover:text-foreground"
							onClick={onRetry}
							type="button"
						>
							Retry
						</button>
					</p>
				) : !rows || rows.length === 0 ? (
					<div className="px-4 py-6 text-center">
						<p className="mx-auto max-w-xs text-muted-foreground text-sm">
							{emptyHint}
						</p>
						<Button asChild={true} className="mt-3" size="sm" variant="outline">
							<Link
								params={{ projectSlug: ws.projectSlug }}
								search={search}
								to="/$projectSlug/tasks"
							>
								{emptyCta}
							</Link>
						</Button>
					</div>
				) : (
					rows.map((t) => (
						<div
							className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
							key={t.id}
						>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">{t.title}</p>
								<p className="text-muted-foreground text-xs">
									{t.projectName ?? "no project"}
								</p>
							</div>
							<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
								{formatAgo(t.startedAt ?? t.queuedAt)}
							</span>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function DashboardPage() {
	const ws = useWorkspace();
	const projectId = ws.isMulti ? undefined : ws.projectId;

	const runningQuery = useQuery({
		...rpc.tasks.list.queryOptions({
			input: { limit: 5, projectId, status: "running" },
		}),
		refetchInterval: 15_000,
	});
	const queuedQuery = useQuery({
		...rpc.tasks.list.queryOptions({
			input: { limit: 5, projectId, status: "queued" },
		}),
		refetchInterval: 15_000,
	});
	const taskStatsQuery = useQuery({
		...rpc.tasks.stats.queryOptions({
			input: projectId ? { projectId } : undefined,
		}),
		refetchInterval: 15_000,
	});
	const signalStatsQuery = useQuery({
		...rpc.signals.stats.queryOptions({
			input: projectId ? { projectId } : undefined,
		}),
		refetchInterval: 15_000,
	});

	const running = [...(runningQuery.data?.items ?? [])].sort(
		(a, b) =>
			new Date(a.startedAt ?? a.queuedAt).getTime() -
			new Date(b.startedAt ?? b.queuedAt).getTime(),
	);
	const queued = [...(queuedQuery.data?.items ?? [])].sort(
		(a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
	);

	const runningCount = taskStatsQuery.data?.running ?? 0;
	const queuedCount = taskStatsQuery.data?.queued ?? 0;
	const newSignals = signalStatsQuery.data?.new ?? 0;
	const newSignalsLabel = signalStatsQuery.isPending ? "…" : String(newSignals);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl">Dashboard</h1>
				<p className="text-muted-foreground text-sm">
					{ws.isMulti
						? "All projects — work in flight and waiting · refreshes every 15s."
						: `${ws.project.name} — work in flight and waiting · refreshes every 15s.`}
				</p>
			</div>

			<Card className="rounded-md border">
				<CardContent className="flex items-center justify-between py-3">
					<div>
						<p className="font-semibold text-sm">New signals</p>
						<p className="text-muted-foreground text-xs">
							Issues waiting to be triaged into tasks
						</p>
					</div>
					<div className="flex items-center gap-3">
						<span className="font-semibold text-2xl tabular-nums">
							{newSignalsLabel}
						</span>
						<Button asChild={true} size="sm" variant="outline">
							<Link
								params={{ projectSlug: ws.projectSlug }}
								search={{ status: "new" }}
								to="/$projectSlug/signals"
							>
								Review
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				<TaskListCard
					description="Agents actively working — longest-running first"
					emptyCta="Open Tasks"
					emptyHint="Nothing is running. Start a queued task to put an agent to work."
					isError={runningQuery.isError}
					isLoading={runningQuery.isPending}
					onRetry={() => void runningQuery.refetch()}
					rows={running}
					search={{ status: "running" }}
					title={`Ongoing (${taskStatsQuery.isPending ? "…" : runningCount})`}
				/>
				<TaskListCard
					description="Accepted work waiting to start — FIFO"
					emptyCta="Open Tasks"
					emptyHint="The queue is empty. Queue a task or triage a signal into one."
					isError={queuedQuery.isError}
					isLoading={queuedQuery.isPending}
					onRetry={() => void queuedQuery.refetch()}
					rows={queued}
					search={{ status: "queued" }}
					title={`Queued (${taskStatsQuery.isPending ? "…" : queuedCount})`}
				/>
			</div>
		</div>
	);
}
