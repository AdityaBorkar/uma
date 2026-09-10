import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { useWorkspace } from "#/components/workspace.tsx";
import { rpc } from "#/lib/rpc.ts";

export const LIST_LIMIT = 20;
export const PROJECT_OPTIONS_LIMIT = 100;

export function useWorkspaceProjectId(): string | undefined {
	const ws = useWorkspace();
	return ws.isMulti ? undefined : ws.projectId;
}

export function useProjects() {
	const query = useQuery(
		rpc.projects.list.queryOptions({ input: { limit: PROJECT_OPTIONS_LIMIT } }),
	);
	const projects = query.data?.items ?? [];
	return { projects, query };
}

export function useProjectOptions() {
	const { projects, query } = useProjects();
	const options = projects.map((p) => ({ id: p.id, name: p.name }));
	return { options, query };
}

export function useMutationErrorToast(title = "Error") {
	const { toast } = useToast();
	return (error: unknown) => {
		toast({
			description: error instanceof Error ? error.message : "Failed",
			title,
			variant: "destructive",
		});
	};
}

export function PageHeader({
	action,
	description,
	title,
}: {
	action?: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 className="font-semibold text-2xl">{title}</h1>
				<p className="text-muted-foreground text-sm">{description}</p>
			</div>
			{action}
		</div>
	);
}

export function ListLoadingCard({ label }: { label: string }) {
	return (
		<Card className="overflow-hidden p-0">
			<div className="border-b bg-muted/50 px-4 py-2 text-muted-foreground text-xs">
				{label}
			</div>
			<div className="space-y-3 p-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</Card>
	);
}

export function ListErrorAlert({
	error,
	onRetry,
	title,
}: {
	error: unknown;
	onRetry: () => void;
	title: string;
}) {
	return (
		<Alert variant="destructive">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription className="flex items-center justify-between">
				<span>{error instanceof Error ? error.message : "Unknown error"}</span>
				<Button onClick={onRetry} size="sm" variant="outline">
					Retry
				</Button>
			</AlertDescription>
		</Alert>
	);
}

export function ListEmptyCard({
	action,
	description,
	title,
}: {
	action?: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<Card className="py-10">
			<CardContent className="text-center">
				<p className="font-semibold text-sm">{title}</p>
				<p className="mx-auto mt-1 max-w-md text-muted-foreground text-sm">
					{description}
				</p>
				{action}
			</CardContent>
		</Card>
	);
}

export function ListResultCard({
	children,
	summary,
}: {
	children: ReactNode;
	summary: ReactNode;
}) {
	return (
		<Card className="overflow-hidden p-0">
			<div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
				{summary}
			</div>
			{children}
		</Card>
	);
}

/** Cursor-pagination footer for every list backed by `{ items, nextCursor }`. */
export function ListMore({
	hasMore,
	onClick,
	pending,
}: {
	hasMore: boolean;
	onClick: () => void;
	pending: boolean;
}) {
	if (!hasMore) {
		return null;
	}
	return (
		<div className="border-t bg-muted/50 px-4 py-2 text-center">
			<Button disabled={pending} onClick={onClick} size="sm" variant="outline">
				{pending ? "Loading…" : "Load more"}
			</Button>
		</div>
	);
}
