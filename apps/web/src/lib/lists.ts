import { useMemo, useState } from "react";

import { useWorkspace } from "#/components/workspace.tsx";

/** Flatten TanStack infinite `{ pages: [{ items }] }` caches. */
export function flattenPages<T>(
	data: { pages: Array<{ items: T[] }> } | undefined,
): T[] {
	return data?.pages.flatMap((page) => page.items) ?? [];
}

/** Items + count pair used by every infinite list page. */
export function useInfiniteItems<T>(
	data: { pages: Array<{ items: T[] }> } | undefined,
): { count: number; items: T[] } {
	const items = useMemo(() => flattenPages(data), [data]);
	return { count: items.length, items };
}

/**
 * Local needle filter for registry pages (skills/mcp/subagents/
 * prompt-templates). Replaces the identical `useMemo` needle blocks that
 * lower-case name/source and match `includes(needle)`.
 */
export function useFilteredByQuery<T>(
	items: T[],
	query: string | undefined,
	pick: (item: T) => string[],
): T[] {
	return useMemo(() => {
		const needle = (query ?? "").trim().toLowerCase();
		if (!needle) {
			return items;
		}
		return items.filter((item) =>
			pick(item).some((hay) => hay.toLowerCase().includes(needle)),
		);
	}, [items, query, pick]);
}

/** Scope subtitle: "All projects…" vs "<name>…". Replaces dashboard/monitor ternaries. */
export function useScopeSubtitle(suffix: string): string {
	const ws = useWorkspace();
	if (ws.isMulti) {
		return `All projects — ${suffix}`;
	}
	return `${ws.project.name} — ${suffix}`;
}

/**
 * Registry create/edit dialog state. Replaces `createOpen/createInitial/
 * editing/openCreate/openDuplicate` triplets in prompt-templates/subagents.
 */
export function useRegistryDialogState<TRow, TForm>(
	empty: TForm,
	toForm: (row: TRow) => TForm,
	getName: (row: TRow) => string,
) {
	const [createOpen, setCreateOpen] = useState(false);
	const [createInitial, setCreateInitial] = useState<TForm>(empty);
	const [editing, setEditing] = useState<TRow | null>(null);

	function openCreate() {
		setCreateInitial(empty);
		setCreateOpen(true);
	}

	function openDuplicate(row: TRow) {
		setCreateInitial({ ...toForm(row), name: `${getName(row)}-copy` } as TForm);
		setCreateOpen(true);
	}

	function closeCreate() {
		setCreateOpen(false);
		setCreateInitial(empty);
	}

	function closeEditing() {
		setEditing(null);
	}

	return {
		closeCreate,
		closeEditing,
		createInitial,
		createOpen,
		editing,
		openCreate,
		openDuplicate,
		setCreateInitial,
		setCreateOpen,
		setEditing,
	};
}

/** Existing names minus the row being edited (for duplicate checks). */
export function editingNames(
	allNames: string[],
	editingName: string | null,
): string[] {
	if (!editingName) {
		return allNames;
	}
	return allNames.filter((n) => n !== editingName);
}
