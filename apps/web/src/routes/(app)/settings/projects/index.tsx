import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import {
	LIST_LIMIT,
	ListEmptyCard,
	ListErrorAlert,
	ListLoadingCard,
	ListMore,
	ListResultCard,
	PageHeader,
} from "#/components/lists/shared.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { rpc } from "#/lib/rpc.ts";
import {
	PROJECT_STATUS_VALUES,
	type ProjectStatus,
	ProjectStatusEnum,
} from "#/schemas/schema.ts";

export const Route = createFileRoute("/(app)/settings/projects/")({
	component: ProjectsPage,
});

function ProjectsPage() {
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<ProjectStatus | "">("");

	const projectsQuery = useInfiniteQuery(
		rpc.projects.list.infiniteOptions({
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: undefined,
			input: (cursor: string | undefined) => ({
				cursor,
				limit: LIST_LIMIT,
				q: q || undefined,
				status: status || undefined,
			}),
		}),
	);

	const items = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<div className="space-y-4">
			<PageHeader
				action={
					<Button asChild={true} variant="primary">
						<Link to="/settings/projects/new">New project</Link>
					</Button>
				}
				description="Organize your work into projects."
				title="Projects"
			/>

			<Card>
				<CardContent className="flex flex-col gap-3 bg-muted/50 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-1.5">
						<Label className="font-semibold text-xs" htmlFor="q">
							Search
						</Label>
						<Input
							id="q"
							onChange={(e) => setQ(e.target.value)}
							placeholder="Filter by name"
							value={q}
						/>
					</div>
					<div className="w-full space-y-1.5 sm:w-40">
						<Label className="font-semibold text-xs" htmlFor="statusFilter">
							Status
						</Label>
						<Select
							id="statusFilter"
							onChange={(e) => {
								const next = ProjectStatusEnum.safeParse(e.target.value);
								setStatus(next.success ? next.data : "");
							}}
							value={status}
						>
							<option value="">All</option>
							{PROJECT_STATUS_VALUES.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</Select>
					</div>
				</CardContent>
			</Card>

			{projectsQuery.isPending ? (
				<ListLoadingCard label="Loading projects…" />
			) : projectsQuery.isError ? (
				<ListErrorAlert
					error={projectsQuery.error}
					onRetry={() => void projectsQuery.refetch()}
					title="Failed to load projects"
				/>
			) : items.length === 0 ? (
				<ListEmptyCard
					action={
						<Button asChild={true} className="mt-4" variant="primary">
							<Link to="/settings/projects/new">Create project</Link>
						</Button>
					}
					description="Create your first project to start planning."
					title="No projects yet"
				/>
			) : (
				<ListResultCard
					summary={
						<>
							<span className="font-semibold">{items.length} projects</span>
							<span className="text-muted-foreground">· {status || "all"}</span>
						</>
					}
				>
					<div>
						{items.map((p) => (
							<div
								className="flex flex-col gap-3 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
								key={p.id}
							>
								<div className="min-w-0 flex-1">
									<Link
										className="font-semibold text-sm hover:text-[var(--color-accent-fg)] hover:underline"
										params={{ projectSlug: p.slug }}
										to="/$projectSlug/dashboard"
									>
										{p.name}
									</Link>
									<span className="ml-2 text-muted-foreground text-xs">
										/{p.slug}
									</span>
									{p.description ? (
										<p className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
											{p.description}
										</p>
									) : null}
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
									<Badge
										variant={p.status === "active" ? "success" : "outline"}
									>
										{p.status}
									</Badge>
									<span className="text-muted-foreground text-xs">
										Updated{" "}
										{new Date(p.updatedAt).toLocaleDateString("en-US", {
											timeZone: "UTC",
										})}
									</span>
									<Button asChild={true} size="sm" variant="outline">
										<Link
											params={{ projectSlug: p.slug }}
											to="/$projectSlug/dashboard"
										>
											Open
										</Link>
									</Button>
									<Button asChild={true} size="sm" variant="outline">
										<Link
											params={{ projectId: p.id }}
											to="/settings/projects/$projectId"
										>
											Manage
										</Link>
									</Button>
								</div>
							</div>
						))}
					</div>
					<ListMore
						hasMore={projectsQuery.hasNextPage}
						onClick={() => void projectsQuery.fetchNextPage()}
						pending={projectsQuery.isFetchingNextPage}
					/>
				</ListResultCard>
			)}
		</div>
	);
}
