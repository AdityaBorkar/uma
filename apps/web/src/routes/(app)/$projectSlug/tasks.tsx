import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useState } from "react";

import { FormDialog } from "#/components/forms/FormDialog.tsx";
import { FilterBar } from "#/components/lists/FilterBar.tsx";
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
import { flattenPages } from "#/lib/lists.ts";
import { rpc } from "#/lib/rpc.ts";
import { type TaskStatus, TaskStatusEnum } from "#/schemas/schema.ts";
import { useUrlSearchInput } from "#/stores/filters.ts";
import {
	invalidateTasks,
	optimisticTaskStatus,
} from "#/stores/invalidation.ts";

interface TasksSearch {
	q?: string;
	status?: TaskStatus;
}

export const Route = createFileRoute("/(app)/$projectSlug/tasks")({
	component: TasksPage,
	head: () => ({
		meta: [
			{ title: "Tasks — Planner" },
			{
				content: "Queue, start, retry and track agent-executable tasks.",
				name: "description",
			},
		],
	}),
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

	const [qInput, setQInput] = useUrlSearchInput({
		onCommit: (q) => setSearch({ q }),
		urlQ: search.q,
	});

	function invalidate() {
		invalidateTasks(queryClient);
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
			onMutate: (vars) =>
				optimisticTaskStatus({
					id: vars.id,
					queryClient,
					status: vars.status,
				}),
			onSettled: () => invalidate(),
			onSuccess: (_data, vars) => {
				posthog.capture("task_status_changed", { to: vars.status });
			},
		}),
	);

	const items = flattenPages(tasksQuery.data);
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

			<FilterBar
				filters={[
					{
						id: "statusFilter",
						label: "Status",
						onChange: (value) => {
							const status = TaskStatusEnum.safeParse(value);
							setSearch({ status: status.success ? status.data : undefined });
						},
						options: [
							{ label: "All", value: "" },
							{ label: "queued", value: "queued" },
							{ label: "running", value: "running" },
							{ label: "completed", value: "completed" },
							{ label: "failed", value: "failed" },
							{ label: "cancelled", value: "cancelled" },
						],
						value: search.status ?? "",
					},
				]}
				search={{
					onChange: setQInput,
					placeholder: "Filter by title",
					value: qInput,
				}}
			/>

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

			<FormDialog
				onClose={() => setOpen(false)}
				onOpenChange={setOpen}
				open={open}
				title="New Task"
			>
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
			</FormDialog>
		</div>
	);
}
