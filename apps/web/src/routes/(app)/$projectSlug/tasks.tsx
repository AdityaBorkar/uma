import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useState } from "react";

import {
	LIST_LIMIT,
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListMore,
	ListResultCard,
	PageHeader,
	useMutationErrorToast,
	useProjectOptions,
	useWorkspaceProjectId,
} from "#/components/lists/shared.tsx";
import { TaskForm } from "#/components/tasks/TaskForm.tsx";
import { TaskTable } from "#/components/tasks/TaskTable.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";
import { type TaskStatus, TaskStatusEnum } from "#/schemas/schema.ts";

interface TasksSearch {
	q?: string;
	status?: TaskStatus;
}

export const Route = createFileRoute("/(app)/$projectSlug/tasks")({
	component: TasksPage,
	validateSearch: (search: Record<string, unknown>): TasksSearch => {
		const status = TaskStatusEnum.safeParse(search.status);
		return {
			q: typeof search.q === "string" ? search.q : undefined,
			status: status.success ? status.data : undefined,
		};
	},
});

function TasksPage() {
	const projectId = useWorkspaceProjectId();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const onMutationError = useMutationErrorToast();
	const search = Route.useSearch();
	const [open, setOpen] = useState(false);

	function setSearch(patch: Partial<TasksSearch>) {
		void navigate({
			replace: true,
			search: (prev) => ({ ...prev, ...patch }),
		});
	}

	function invalidate() {
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.tasks.list.key()),
		});
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.tasks.stats.key()),
		});
	}

	const tasksQuery = useInfiniteQuery(
		rpc.tasks.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: undefined,
			input: (cursor: string | undefined) => ({
				cursor,
				limit: LIST_LIMIT,
				projectId,
				q: search.q || undefined,
				status: search.status,
			}),
		}),
	);

	const { options: projectOptions } = useProjectOptions();

	const signalsQuery = useQuery(
		rpc.signals.list.queryOptions({
			input: { limit: 100, status: "new" },
		}),
	);

	const agentsQuery = useQuery(
		rpc.agents.list.queryOptions({ input: undefined }),
	);

	const createMut = useMutation(
		rpc.tasks.create.mutationOptions({
			onError: onMutationError,
			onSuccess: (data) => {
				invalidate();
				posthog.capture("task_created", { taskId: data.id });
				setOpen(false);
			},
		}),
	);

	const statusMut = useMutation(
		rpc.tasks.updateStatus.mutationOptions({
			onError: onMutationError,
			onSuccess: (_data, vars) => {
				invalidate();
				posthog.capture("task_status_changed", { to: vars.status });
			},
		}),
	);

	const items = tasksQuery.data?.pages.flatMap((page) => page.items);
	const signalOptions = (signalsQuery.data?.items ?? []).map((s) => ({
		id: s.id,
		title: s.title,
	}));
	const agentOptions = (agentsQuery.data ?? []).map((a) => ({
		name: a.name,
	}));

	const count = items?.length ?? 0;

	return (
		<div className="space-y-4">
			<PageHeader
				action={
					<Button onClick={() => setOpen(true)} variant="primary">
						New task
					</Button>
				}
				description="Agentic work — queue it, start it, retry it when it fails."
				title="Tasks"
			/>

			<Card>
				<CardContent className="flex flex-col gap-3 bg-muted/50 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-1.5">
						<Label className="font-semibold text-xs" htmlFor="q">
							Search
						</Label>
						<Input
							id="q"
							onChange={(e) => setSearch({ q: e.target.value || undefined })}
							placeholder="Filter by title"
							value={search.q ?? ""}
						/>
					</div>
					<div className="w-full space-y-1.5 sm:w-40">
						<Label className="font-semibold text-xs" htmlFor="statusFilter">
							Status
						</Label>
						<Select
							id="statusFilter"
							onChange={(e) => {
								const status = TaskStatusEnum.safeParse(e.target.value);
								setSearch({ status: status.success ? status.data : undefined });
							}}
							value={search.status ?? ""}
						>
							<option value="">All</option>
							<option value="queued">queued</option>
							<option value="running">running</option>
							<option value="completed">completed</option>
							<option value="failed">failed</option>
							<option value="cancelled">cancelled</option>
						</Select>
					</div>
				</CardContent>
			</Card>

			{tasksQuery.isPending ? (
				<ListLoadingCard label="Loading tasks…" />
			) : tasksQuery.isError ? (
				<ListErrorAlert
					error={tasksQuery.error}
					onRetry={() => void tasksQuery.refetch()}
					title="Failed to load tasks"
				/>
			) : !items || items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button
							className="mt-4"
							onClick={() => setOpen(true)}
							variant="primary"
						>
							Queue a task
						</Button>
					}
					description="No tasks match. Queue a task directly, or triage a signal on the Signals page into ready work."
					title="No tasks"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{count} tasks</span>
							<span className="text-muted-foreground">
								· {search.status || "all"}
							</span>
						</>
					}
				>
					<TaskTable
						isPending={statusMut.isPending}
						items={items}
						onStatusChange={(id, status) => statusMut.mutate({ id, status })}
					/>
					<ListMore
						hasMore={tasksQuery.hasNextPage}
						onClick={() => void tasksQuery.fetchNextPage()}
						pending={tasksQuery.isFetchingNextPage}
					/>
				</ListResultCard>
			)}

			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent onClose={() => setOpen(false)}>
					<DialogHeader>
						<DialogTitle>New Task</DialogTitle>
					</DialogHeader>
					<TaskForm
						agents={agentOptions}
						loading={createMut.isPending}
						onCancel={() => setOpen(false)}
						onSubmit={async (values) => {
							await createMut.mutateAsync({
								agent: values.agent,
								projectId: values.projectId,
								prompt: values.prompt || undefined,
								signalId: values.signalId,
								title: values.title,
							});
						}}
						projects={projectOptions}
						signals={signalOptions}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
