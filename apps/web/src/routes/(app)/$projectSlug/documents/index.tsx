import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";

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
import { useHoverCapable } from "#/lib/hooks/use-hover-capable.ts";
import { flattenPages } from "#/lib/lists.ts";
import { rpc } from "#/lib/rpc.ts";
import { cn } from "#/lib/utils.ts";
import {
	type DocumentKind,
	DocumentKindEnum,
	DocumentStateEnum,
	kindLabel,
} from "#/schemas/schema.ts";
import {
	clearCreateIntent,
	createIntentStore,
} from "#/stores/command-palette.ts";
import { useUrlSearchInput } from "#/stores/filters.ts";

interface DocumentsSearch {
	kind?: DocumentKind;
	label?: string;
	q?: string;
	state?: "open" | "closed";
}

const DOCUMENT_GROUPS: Array<{
	label: string;
	value: DocumentKind | undefined;
}> = [
	{ label: "All documents", value: undefined },
	{ label: "Wiki", value: "wiki" },
	{ label: "Specification", value: "spec" },
	{ label: "Bug Reports", value: "bug_report" },
];

// Settle without overshoot: the group rail scrolls on small screens, so even
// a small overshoot would flash a transient scrollbar (same spring as
// motion/tabs.tsx and layout/UnderlineNav.tsx).
const GROUP_TRANSITION = {
	damping: 30,
	mass: 1.2,
	stiffness: 170,
	type: "spring",
} as const;

export const Route = createFileRoute("/(app)/$projectSlug/documents/")({
	component: DocumentsPage,
	head: () => ({
		meta: [
			{ title: "Documents — Planner" },
			{
				content: "Browse wiki pages, specs and bug reports.",
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
	// Command K "New document" lands here via a one-shot intent.
	const createIntent = useSelector(createIntentStore, (s) => s);
	useEffect(() => {
		if (createIntent === "document") {
			clearCreateIntent();
			setCreateOpen(true);
		}
	}, [createIntent]);
	// Group rail hover language
	// (beui.dev/components/motion/shared-layout-bg): a muted wash glides
	// between hovered groups on its own layoutId while the active surface
	// keeps gliding on the primary one. Touch taps fire phantom `:hover`
	// that sticks, so the hover pill only tracks where a true hover exists.
	const groupActiveId = useId();
	const groupHoverId = useId();
	const reduce = useReducedMotion();
	const canHover = useHoverCapable();
	const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

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
				description="Wiki pages, specs and bug reports."
				title="Documents"
			/>

			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<nav aria-label="Document groups" className="w-full shrink-0 lg:w-60">
					<Card className="overflow-hidden p-0">
						<div className="border-b bg-muted/50 px-4 py-2 font-semibold text-muted-foreground text-xs">
							Groups
						</div>
						<motion.ul
							className="flex flex-row gap-1 overflow-x-auto p-2 scrollbar-none lg:flex-col"
							layoutRoot
							onMouseLeave={() => setHoveredGroup(null)}
						>
							{DOCUMENT_GROUPS.map((group) => {
								const active = search.kind === group.value;
								return (
									<li className="shrink-0 lg:shrink" key={group.label}>
										<button
											aria-current={active ? "page" : undefined}
											className={cn(
												"relative w-auto whitespace-nowrap rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 lg:w-full",
												active
													? "font-semibold text-foreground"
													: "text-muted-foreground hover:text-foreground",
											)}
											onBlur={() =>
												setHoveredGroup((cur) =>
													cur === group.label ? null : cur,
												)
											}
											onClick={() => setSearch({ kind: group.value })}
											onFocus={() => setHoveredGroup(group.label)}
											onMouseEnter={() => setHoveredGroup(group.label)}
											onMouseLeave={() =>
												setHoveredGroup((cur) =>
													cur === group.label ? null : cur,
												)
											}
											type="button"
										>
											{active ? (
												<motion.span
													aria-hidden={true}
													className="absolute inset-0 rounded-md bg-muted"
													layout="position"
													layoutId={groupActiveId}
													transition={
														reduce ? { duration: 0 } : GROUP_TRANSITION
													}
												/>
											) : null}
											<AnimatePresence>
												{canHover && !active && hoveredGroup === group.label ? (
													<motion.span
														animate={
															reduce
																? { opacity: 1 }
																: { filter: "blur(0px)", opacity: 1 }
														}
														aria-hidden={true}
														className="absolute inset-0 rounded-md bg-muted/50"
														exit={
															reduce
																? { opacity: 0 }
																: { filter: "blur(4px)", opacity: 0 }
														}
														initial={
															reduce
																? { opacity: 0 }
																: { filter: "blur(4px)", opacity: 0 }
														}
														key="group-hover"
														layout="position"
														layoutId={groupHoverId}
														transition={
															reduce ? { duration: 0 } : GROUP_TRANSITION
														}
													/>
												) : null}
											</AnimatePresence>
											<span className="relative">{group.label}</span>
										</button>
									</li>
								);
							})}
						</motion.ul>
					</Card>
				</nav>

				<div className="min-w-0 flex-1 space-y-4">
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
													? "cursor-pointer border-accent-fg"
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
									<span className="font-semibold">
										{items.length} documents
									</span>
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
													className="font-medium text-sm hover:text-accent-fg hover:underline"
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
															className="px-1.5 py-0 text-micro"
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
			</div>

			<NewDocumentDialog onOpenChange={setCreateOpen} open={createOpen} />
		</div>
	);
}
