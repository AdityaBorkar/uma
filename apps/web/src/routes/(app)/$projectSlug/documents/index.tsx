import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { stateBadgeClass } from "#/components/badges.ts";
import {
	LIST_LIMIT,
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListMore,
	ListResultCard,
	useWorkspaceProjectId,
} from "#/components/lists/shared.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
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
import { rpc } from "#/lib/rpc.ts";
import {
	DOCUMENT_KINDS,
	DocumentKindEnum,
	DocumentStateEnum,
	kindLabel,
} from "#/schemas/schema.ts";

interface DocumentsSearch {
	kind?: (typeof DOCUMENT_KINDS)[number]["value"];
	label?: string;
	q?: string;
	state?: "open" | "closed";
}

export const Route = createFileRoute("/(app)/$projectSlug/documents/")({
	component: DocumentsPage,
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

	function setSearch(patch: Partial<DocumentsSearch>) {
		void navigate({
			replace: true,
			search: (prev) => ({ ...prev, ...patch }),
		});
	}

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

	const items = docsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Documents</h1>
					<p className="text-muted-foreground text-sm">
						Everything is a document — wiki pages, specs, bug reports,
						changelogs.
					</p>
				</div>
				<Button asChild={true} variant="primary">
					<Link
						params={{ projectSlug: ws.projectSlug }}
						to="/$projectSlug/documents/new"
					>
						New document
					</Link>
				</Button>
			</div>

			{/* UnderlineNav — kind tabs */}
			<nav className="flex items-center gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<button
					className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
						search.kind
							? "border-transparent text-muted-foreground hover:text-foreground"
							: "border-[#fd8c73] font-semibold text-foreground"
					}`}
					onClick={() => setSearch({ kind: undefined })}
					type="button"
				>
					All
				</button>
				{DOCUMENT_KINDS.map((k) => (
					<button
						className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
							search.kind === k.value
								? "border-[#fd8c73] font-semibold text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						key={k.value}
						onClick={() => setSearch({ kind: k.value })}
						type="button"
					>
						{k.label}
					</button>
				))}
			</nav>

			<Card>
				<CardContent className="flex flex-col gap-3 bg-muted/50 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-1.5">
						<Label className="font-semibold text-xs" htmlFor="q">
							Search
						</Label>
						<Input
							id="q"
							onChange={(e) => setSearch({ q: e.target.value || undefined })}
							placeholder="Filter by title or body"
							value={search.q ?? ""}
						/>
					</div>
					<div className="w-full space-y-1.5 sm:w-36">
						<Label className="font-semibold text-xs" htmlFor="stateFilter">
							State
						</Label>
						<Select
							id="stateFilter"
							onChange={(e) => {
								const state = DocumentStateEnum.safeParse(e.target.value);
								setSearch({ state: state.success ? state.data : undefined });
							}}
							value={search.state ?? ""}
						>
							<option value="">All</option>
							<option value="open">open</option>
							<option value="closed">closed</option>
						</Select>
					</div>
					<Button
						onClick={() => setShowFilters((v) => !v)}
						size="sm"
						variant="outline"
					>
						{search.label ? `Label: ${search.label}` : "Label"}
					</Button>
				</CardContent>
				{showFilters ? (
					<CardContent className="border-t">
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
				) : null}
			</Card>

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
						<Button asChild={true} className="mt-4" variant="primary">
							<Link
								params={{ projectSlug: ws.projectSlug }}
								to="/$projectSlug/documents/new"
							>
								Create the first document
							</Link>
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
										<Badge
											className={stateBadgeClass(doc.state)}
											variant="outline"
										>
											{doc.state}
										</Badge>
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
		</div>
	);
}
