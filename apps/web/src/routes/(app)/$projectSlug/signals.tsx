import {
	useInfiniteQuery,
	useMutation,
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
import { SignalForm } from "#/components/signals/SignalForm.tsx";
import {
	type SignalRow,
	SignalTable,
} from "#/components/signals/SignalTable.tsx";
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
import {
	type SignalSeverity,
	SignalSeverityEnum,
	type SignalStatus,
	SignalStatusEnum,
} from "#/schemas/schema.ts";

interface SignalsSearch {
	q?: string;
	severity?: SignalSeverity;
	status?: SignalStatus;
}

export const Route = createFileRoute("/(app)/$projectSlug/signals")({
	component: SignalsPage,
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

	function invalidate() {
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.signals.list.key()),
		});
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.signals.stats.key()),
		});
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.tasks.list.key()),
		});
		void queryClient.invalidateQueries({
			queryKey: rpcPathKey(rpc.tasks.stats.key()),
		});
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

	const items = signalsQuery.data?.pages.flatMap((page) => page.items);
	const count = items?.length ?? 0;

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
								const status = SignalStatusEnum.safeParse(e.target.value);
								setSearch({ status: status.success ? status.data : undefined });
							}}
							value={search.status ?? ""}
						>
							<option value="">All</option>
							<option value="new">new</option>
							<option value="triaged">triaged</option>
							<option value="dismissed">dismissed</option>
						</Select>
					</div>
					<div className="w-full space-y-1.5 sm:w-40">
						<Label className="font-semibold text-xs" htmlFor="severityFilter">
							Severity
						</Label>
						<Select
							id="severityFilter"
							onChange={(e) => {
								const severity = SignalSeverityEnum.safeParse(e.target.value);
								setSearch({
									severity: severity.success ? severity.data : undefined,
								});
							}}
							value={search.severity ?? ""}
						>
							<option value="">All</option>
							<option value="info">info</option>
							<option value="warning">warning</option>
							<option value="critical">critical</option>
						</Select>
					</div>
				</CardContent>
			</Card>

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

			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent onClose={() => setOpen(false)}>
					<DialogHeader>
						<DialogTitle>New Signal</DialogTitle>
					</DialogHeader>
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
				</DialogContent>
			</Dialog>
		</div>
	);
}
