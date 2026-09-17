import type { QueryClient } from "@tanstack/react-query";

import { rpc, rpcPathKey } from "#/lib/rpc.ts";

/**
 * Central invalidation map. Every page previously hand-rolled its own
 * `invalidate()` with overlapping `rpcPathKey` sets.
 * All mutation `onSuccess` handlers go through here now.
 */

export function invalidateTasks(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.tasks.list.key()),
	});
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.tasks.stats.key()),
	});
}

export function invalidateDocuments(
	queryClient: QueryClient,
	docNumber?: number,
) {
	if (docNumber !== undefined) {
		void queryClient.invalidateQueries({ queryKey: ["document", docNumber] });
	}
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.documents.list.key()),
	});
}

export function invalidateProjects(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.projects.list.key()),
	});
}

export function invalidateSubagents(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.subagents.list.key()),
	});
}

export function invalidatePromptTemplates(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.promptTemplates.list.key()),
	});
}

export function invalidateAgents(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.agents.list.key()),
	});
}

export function invalidateMachines(queryClient: QueryClient) {
	void queryClient.invalidateQueries({
		queryKey: rpcPathKey(rpc.machines.list.key()),
	});
}

/* ------------------------------------------------------------------ */
/* Optimistic helpers for infinite `{ pages: [{ items }] }` caches.    */
/* ------------------------------------------------------------------ */

interface InfiniteCache<TItem> {
	pageParams: unknown[];
	pages: Array<{ items: TItem[] } & Record<string, unknown>>;
}

function patchInfiniteItems<TItem>(
	queryClient: QueryClient,
	pathKey: readonly unknown[],
	patch: (item: TItem) => TItem | null,
) {
	const queries = queryClient.getQueriesData<InfiniteCache<TItem>>({
		queryKey: pathKey,
	});
	for (const [key, data] of queries) {
		if (!data || !Array.isArray(data.pages)) continue;
		queryClient.setQueryData<InfiniteCache<TItem>>(key, {
			...data,
			pages: data.pages.map((page) => ({
				...page,
				items: page.items.flatMap((item) => {
					const next = patch(item);
					return next === null ? [] : [next];
				}),
			})),
		});
	}
}

export async function optimisticTaskStatus(args: {
	id: string;
	queryClient: QueryClient;
	status: string;
}) {
	await args.queryClient.cancelQueries({
		queryKey: rpcPathKey(rpc.tasks.list.key()),
	});
	patchInfiniteItems<{ id: string; status: string }>(
		args.queryClient,
		rpcPathKey(rpc.tasks.list.key()) as readonly unknown[],
		(item) => (item.id === args.id ? { ...item, status: args.status } : item),
	);
}
