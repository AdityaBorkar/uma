import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { DocStateBadge } from "#/components/data/StatusBadge.tsx";
import { NewDocumentDialog } from "#/components/documents/NewDocumentDialog.tsx";
import { FilterBar } from "#/components/lists/FilterBar.tsx";
import {
	LIST_LIMIT,
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListMore,
	ListResultCard,
	PageHeader,
	useWorkspaceProjectId,
} from "#/components/lists/shared.tsx";
import { UnderlineTabs } from "#/components/lists/UnderlineTabs.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { useWorkspace } from "#/components/workspace.tsx";
import { formatAgo } from "#/lib/age.ts";
import { flattenPages } from "#/lib/lists.ts";
import { rpc } from "#/lib/rpc.ts";
import {
	DOCUMENT_KINDS,
	DocumentKindEnum,
	DocumentStateEnum,
	kindLabel,
} from "#/schemas/schema.ts";
import { useUrlSearchInput } from "#/stores/filters.ts";

interface DocumentsSearch {
	kind?: (typeof DOCUMENT_KINDS)[number]["value"];
	label?: string;
	q?: string;
	state?: "open" | "closed";
}

export const Route = createFileRoute("/(app)/$projectSlug/documents/")({
	component: DocumentsPage,
	head: () => ({
		meta: [
			{ title: "Documents — Planner" },
			{
				content: "Browse wiki pages, specs, bug reports and changelogs.",
				name: "description",
			},
		],
	}),
	validateSearch: (search: Record<string, unknown>): DocumentsSearch => {
		const kind = DocumentKindEnum.safeParse(search.kind);
		const state = DocumentStateEnum.safeParse(search.state);
		return {
			kind: kind.success ? kind.data : undefined,
			label: typeof search.label === "string" ? search.label : undefined,
			q: typeof search.q === "string" ? search.q : undefined,
			state: state.success ? state.data : undefined,
		};
	},
});

function DocumentsPage() {
	const ws = useWorkspace();
	const projectId = useWorkspaceProjectId();
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const [showFilters, setShowFilters] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);

	function setSearch(patch: Partial<DocumentsSearch>) {
		void navigate({
			replace: true,
			search: (prev) => ({ ...prev, ...patch }),
		});
	}

	const [qInput, setQInput] = useUrlSearchInput({
		onCommit: (q) => setSearch({ q }),
		urlQ: search.q,
	});

	const docsQuery = useInfiniteQuery(
		rpc.documents.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: undefined,
			input: (cursor: string | undefined) => ({
				cursor,
				kind: search.kind,
				label: search.label,
				limit: LIST_LIMIT,
				projectId,
				q: search.q || undefined,
				state: search.state,
			}),
		}),
	);

	const items = flattenPages(docsQuery.data);

	return (
		<div className="space-y-4">
			<PageHeader
				action={
					<Button onClick={() => setCreateOpen(true)} variant="primary">
						New document
					</Button>
				}
				description="Wiki pages, specs, bug reports and changelogs."
				title="Documents"
			/>

			<UnderlineTabs
				activeValue={search.kind}
				onSelect={(kind) => setSearch({ kind })}
				tabs={[
					{ label: "All", value: undefined },
					...DOCUMENT_KINDS.map((k) => ({ label: k.label, value: k.value })),
				]}
			/>

			<FilterBar
				actions={
					<Button
						onClick={() => setShowFilters((v) => !v)}
						size="sm"
						variant="outline"
					>
						{search.label ? `Label: ${search.label}` : "Label"}
					</Button>
				}
				filters={[
					{
						id: "stateFilter",
						label: "State",
						onChange: (value) => {
							const state = DocumentStateEnum.safeParse(value);
							setSearch({ state: state.success ? state.data : undefined });
						},
						options: [
							{ label: "All", value: "" },
							{ label: "open", value: "open" },
							{ label: "closed", value: "closed" },
						],
						value: search.state ?? "",
						width: "sm",
					},
				]}
				search={{
					onChange: setQInput,
					placeholder: "Filter by title or body",
					value: qInput,
				}}
			/>
			{showFilters ? (
				<Card>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{["wiki", "spec", "urgent", "api", "bug"].map((label) => (
								<Badge
									className={
										search.label === label
											? "cursor-pointer border-[#0969da]"
											: "cursor-pointer"
									}
									key={label}
									onClick={() =>
										setSearch({
											label: search.label === label ? undefined : label,
										})
									}
									variant="outline"
								>
									{label}
								</Badge>
							))}
							<p className="w-full text-muted-foreground text-xs">
								Labels are free-form — these are shortcuts.
							</p>
						</div>
					</CardContent>
				</Card>
			) : null}

			{docsQuery.isPending ? (
				<ListLoadingCard label="Loading documents…" />
			) : docsQuery.isError ? (
				<ListErrorAlert
					error={docsQuery.error}
					onRetry={() => void docsQuery.refetch()}
					title="Failed to load documents"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button
							className="mt-4"
							onClick={() => setCreateOpen(true)}
							variant="primary"
						>
							Create the first document
						</Button>
					}
					description="No documents yet. Everything you write lives here — start with a wiki page or a specification."
					title="No documents"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{items.length} documents</span>
							<span className="text-muted-foreground">
								· {search.kind ? kindLabel(search.kind) : "all kinds"}
							</span>
							<span className="ml-auto text-muted-foreground">
								{search.state ?? "all states"}
							</span>
						</>
					}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">#</TableHead>
								<TableHead>Title</TableHead>
								<TableHead className="w-28">Kind</TableHead>
								<TableHead className="w-24">State</TableHead>
								<TableHead className="w-40">Labels</TableHead>
								<TableHead className="w-28">Project</TableHead>
								<TableHead className="w-24">Updated</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((doc) => (
								<TableRow key={doc.id}>
									<TableCell className="text-muted-foreground text-xs">
										#{doc.number}
									</TableCell>
									<TableCell>
										<Link
											className="font-medium text-sm hover:text-[var(--color-accent-fg)] hover:underline"
											params={{
												number: String(doc.number),
												projectSlug: ws.projectSlug,
											}}
											to="/$projectSlug/documents/$number"
										>
											{doc.title}
										</Link>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{kindLabel(doc.kind)}
									</TableCell>
									<TableCell>
										<DocStateBadge state={doc.state} />
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap gap-1">
											{doc.labels.slice(0, 3).map((label) => (
												<Badge
													className="px-1.5 py-0 text-[11px]"
													key={label}
													variant="outline"
												>
													{label}
												</Badge>
											))}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{doc.projectName ?? "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatAgo(doc.updatedAt)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<ListMore
						hasMore={docsQuery.hasNextPage}
						onClick={() => void docsQuery.fetchNextPage()}
						pending={docsQuery.isFetchingNextPage}
					/>
				</ListResultCard>
			)}

			<NewDocumentDialog onOpenChange={setCreateOpen} open={createOpen} />
		</div>
	);
}
