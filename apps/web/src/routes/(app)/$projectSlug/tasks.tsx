import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

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
import { type TaskRow, TaskTable } from "#/components/tasks/TaskTable.tsx";
import { Button } from "#/components/ui/button.tsx";
import { flattenPages } from "#/lib/lists.ts";
import { rpc } from "#/lib/rpc.ts";
import { type TaskStatus, TaskStatusEnum } from "#/schemas/schema.ts";
import {
	clearCreateIntent,
	createIntentStore,
} from "#/stores/command-palette.ts";
import { useUrlSearchInput } from "#/stores/filters.ts";
import {
	invalidateTasks,
	optimisticTaskStatus,
} from "#/stores/invalidation.ts";

export interface TasksSearch {
	q?: string | undefined;
	status?: TaskStatus | undefined;
}

function asStringOrNull(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asDate(value: unknown): string | Date | null {
	return typeof value === "string" || value instanceof Date ? value : null;
}

function toTaskRow(item: Record<string, unknown>): TaskRow | null {
	if (typeof item.id !== "string" || typeof item.title !== "string") {
		return null;
	}
	const status = TaskStatusEnum.safeParse(item.status);
	if (!status.success) {
		return null;
	}
	const queuedAt = asDate(item.queuedAt);
	if (queuedAt === null) {
		return null;
	}
	const startedAt =
		item.startedAt === null || item.startedAt === undefined
			? null
			: asDate(item.startedAt);
	if (
		item.startedAt !== null &&
		item.startedAt !== undefined &&
		startedAt === null
	) {
		return null;
	}
	const finishedAt =
		item.finishedAt === null || item.finishedAt === undefined
			? null
			: asDate(item.finishedAt);
	if (
		item.finishedAt !== null &&
		item.finishedAt !== undefined &&
		finishedAt === null
	) {
		return null;
	}
	return {
		agent: typeof item.agent === "string" ? item.agent : "cli",
		finishedAt,
		id: item.id,
		projectId: asStringOrNull(item.projectId),
		projectName: asStringOrNull(item.projectName),
		queuedAt,
		startedAt,
		status: status.data,
		title: item.title,
	};
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

	// Command K "New task" lands here via a one-shot intent.
	const createIntent = useSelector(createIntentStore, (s) => s);
	useEffect(() => {
		if (createIntent === "task") {
			clearCreateIntent();
			setOpen(true);
		}
	}, [createIntent]);

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

	const items = flattenPages(tasksQuery.data)
		.map((item) => toTaskRow(item as Record<string, unknown>))
		.filter((row): row is TaskRow => row !== null);
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
					description="No tasks match. Queue a task to put an agent to work."
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
							title: values.title,
						});
					}}
					projects={projectOptions}
				/>
			</FormDialog>
		</div>
	);
}
