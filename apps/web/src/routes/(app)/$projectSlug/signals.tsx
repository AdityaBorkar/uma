import {
	useInfiniteQuery,
	useMutation,
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
import { SignalForm } from "#/components/signals/SignalForm.tsx";
import {
	type SignalRow,
	SignalTable,
} from "#/components/signals/SignalTable.tsx";
import { Button } from "#/components/ui/button.tsx";
import { flattenPages } from "#/lib/lists.ts";
import { rpc } from "#/lib/rpc.ts";
import {
	type SignalSeverity,
	SignalSeverityEnum,
	type SignalStatus,
	SignalStatusEnum,
} from "#/schemas/schema.ts";
import { useUrlSearchInput } from "#/stores/filters.ts";
import {
	invalidateSignalAndTasks,
	invalidateSignals,
	optimisticSignalStatus,
} from "#/stores/invalidation.ts";

interface SignalsSearch {
	q?: string;
	severity?: SignalSeverity;
	status?: SignalStatus;
}

export const Route = createFileRoute("/(app)/$projectSlug/signals")({
	component: SignalsPage,
	head: () => ({
		meta: [
			{ title: "Signals — Planner" },
			{
				content:
					"Capture inbound issues and triage them into tasks or dismiss them.",
				name: "description",
			},
		],
	}),
	validateSearch: (search: Record<string, unknown>): SignalsSearch => {
		const severity = SignalSeverityEnum.safeParse(search.severity);
		const status = SignalStatusEnum.safeParse(search.status);
		return {
			q: typeof search.q === "string" ? search.q : undefined,
			severity: severity.success ? severity.data : undefined,
			status: status.success ? status.data : undefined,
		};
	},
});

function SignalsPage() {
	const projectId = useWorkspaceProjectId();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const onMutationError = useMutationErrorToast();
	const search = Route.useSearch();
	const [open, setOpen] = useState(false);

	function setSearch(patch: Partial<SignalsSearch>) {
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
		invalidateSignalAndTasks(queryClient);
	}

	const signalsQuery = useInfiniteQuery(
		rpc.signals.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: undefined,
			input: (cursor: string | undefined) => ({
				cursor,
				limit: LIST_LIMIT,
				projectId,
				q: search.q || undefined,
				severity: search.severity,
				status: search.status,
			}),
		}),
	);

	const { options: projectOptions } = useProjectOptions();

	const createMut = useMutation(
		rpc.signals.create.mutationOptions({
			onError: onMutationError,
			onSuccess: () => {
				invalidate();
				posthog.capture("signal_created");
				setOpen(false);
			},
		}),
	);

	const updateMut = useMutation(
		rpc.signals.update.mutationOptions({
			onError: onMutationError,
			onMutate: (vars) =>
				optimisticSignalStatus({
					id: vars.id,
					queryClient,
					status: vars.status,
				}),
			onSettled: () => invalidateSignals(queryClient),
			onSuccess: () => invalidate(),
		}),
	);

	const createTaskMut = useMutation(
		rpc.tasks.create.mutationOptions({
			onError: onMutationError,
			onSuccess: () => {
				invalidate();
				posthog.capture("task_created");
			},
		}),
	);

	async function handleCreateTask(signal: SignalRow) {
		try {
			await createTaskMut.mutateAsync({
				projectId: signal.projectId ?? undefined,
				signalId: signal.id,
				title: signal.title,
			});
			if (signal.status === "new") {
				await updateMut.mutateAsync({ id: signal.id, status: "triaged" });
			}
			posthog.capture("signal_triaged");
		} catch {
			// toasts already surfaced by mutation onError handlers
		}
	}

	function handleTriage(signal: SignalRow) {
		updateMut.mutate({ id: signal.id, status: "triaged" });
	}

	function handleDismiss(signal: SignalRow) {
		updateMut.mutate({ id: signal.id, status: "dismissed" });
		posthog.capture("signal_dismissed");
	}

	const items = flattenPages(signalsQuery.data);
	const count = items.length;

	return (
		<div className="space-y-4">
			<PageHeader
				action={
					<Button onClick={() => setOpen(true)} variant="primary">
						New signal
					</Button>
				}
				description="Issues worth attention — triage them into tasks or dismiss them."
				title="Signals"
			/>

			<FilterBar
				filters={[
					{
						id: "statusFilter",
						label: "Status",
						onChange: (value) => {
							const status = SignalStatusEnum.safeParse(value);
							setSearch({ status: status.success ? status.data : undefined });
						},
						options: [
							{ label: "All", value: "" },
							{ label: "new", value: "new" },
							{ label: "triaged", value: "triaged" },
							{ label: "dismissed", value: "dismissed" },
						],
						value: search.status ?? "",
					},
					{
						id: "severityFilter",
						label: "Severity",
						onChange: (value) => {
							const severity = SignalSeverityEnum.safeParse(value);
							setSearch({
								severity: severity.success ? severity.data : undefined,
							});
						},
						options: [
							{ label: "All", value: "" },
							{ label: "info", value: "info" },
							{ label: "warning", value: "warning" },
							{ label: "critical", value: "critical" },
						],
						value: search.severity ?? "",
					},
				]}
				search={{
					onChange: setQInput,
					placeholder: "Filter by title",
					value: qInput,
				}}
			/>

			{signalsQuery.isPending ? (
				<ListLoadingCard label="Loading signals…" />
			) : signalsQuery.isError ? (
				<ListErrorAlert
					error={signalsQuery.error}
					onRetry={() => void signalsQuery.refetch()}
					title="Failed to load signals"
				/>
			) : !items || items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button
							className="mt-4"
							onClick={() => setOpen(true)}
							variant="primary"
						>
							Capture a signal
						</Button>
					}
					description="No signals match. Capture issues as they surface — a failing build, a user complaint, a hunch — then triage them into tasks."
					title="No signals"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{count} signals</span>
							<span className="text-muted-foreground">
								· {search.status || "all"} · {search.severity || "all"}
							</span>
						</>
					}
				>
					<SignalTable
						isTaskPending={createTaskMut.isPending}
						isUpdatePending={updateMut.isPending}
						items={items}
						onCreateTask={(s) => void handleCreateTask(s)}
						onDismiss={handleDismiss}
						onTriage={handleTriage}
					/>
					<ListMore
						hasMore={signalsQuery.hasNextPage}
						onClick={() => void signalsQuery.fetchNextPage()}
						pending={signalsQuery.isFetchingNextPage}
					/>
				</ListResultCard>
			)}

			<FormDialog
				onClose={() => setOpen(false)}
				onOpenChange={setOpen}
				open={open}
				title="New Signal"
			>
				<SignalForm
					loading={createMut.isPending}
					onCancel={() => setOpen(false)}
					onSubmit={async (values) => {
						await createMut.mutateAsync({
							body: values.body || undefined,
							projectId: values.projectId,
							severity: values.severity,
							title: values.title,
							url: values.url,
						});
					}}
					projects={projectOptions}
					submitLabel="Capture signal"
				/>
			</FormDialog>
		</div>
	);
}
