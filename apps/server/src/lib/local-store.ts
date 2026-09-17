import { Store } from "@tanstack/store";
import { z } from "zod";

import { onStorageKey, readStorage, writeStorage } from "../stores/persist.ts";

/** Define a localStorage-backed store shape with Zod validation. */
export function defineLocalStore<T>(
	key: string,
	schema: z.ZodType<T>,
	empty: T,
) {
	function parse(raw: unknown): T {
		if (typeof raw !== "string") return empty;
		try {
			const parsed: unknown = JSON.parse(raw);
			const result = schema.safeParse(parsed);
			return result.success ? result.data : empty;
		} catch {
			return empty;
		}
	}

	function load(): T {
		const raw = readStorage(key);
		if (raw === null) return empty;
		return parse(raw);
	}

	function save(store: T): void {
		try {
			writeStorage(key, JSON.stringify(store));
		} catch {
			// Storage full — pages keep working in memory.
		}
	}

	return { empty, key, load, parse, save, schema };
}

export type LocalStoreDef<T> = ReturnType<typeof defineLocalStore<T>>;

/** Create a TanStack Store wired to localStorage + cross-tab sync. */
export function createPersistentStore<T>(def: LocalStoreDef<T>) {
	const store = new Store<T>(def.empty);

	function hydrate(isEmpty: (s: T) => boolean = (s) => s === def.empty): void {
		if (typeof window === "undefined") return;
		if (!isEmpty(store.state)) return;
		try {
			const next = def.load();
			if (!isEmpty(next)) store.setState(() => next);
		} catch {
			// ignore — keep empty
		}
	}

	if (typeof window !== "undefined") {
		store.subscribe((v) => def.save(v));
		onStorageKey(def.key, (raw) => {
			if (raw === null) return;
			try {
				store.setState(() => def.parse(raw));
			} catch {
				// ignore malformed cross-tab payloads
			}
		});
	}

	return { hydrate, store };
}

/** Generic { items: T[] } registry with id-based CRUD. */
export function createListRegistry<T extends { id: string }>(
	key: string,
	entrySchema: z.ZodType<T>,
) {
	const schema = z.object({ items: z.array(entrySchema).default([]) });
	type ListStore = z.infer<typeof schema>;
	const def = defineLocalStore<ListStore>(key, schema, { items: [] });
	const { hydrate, store } = createPersistentStore(def);

	function hydrateStore(): void {
		hydrate((s) => s.items.length === 0);
	}

	function addItem(item: T): void {
		store.setState((prev) => ({ items: [...prev.items, item] }));
	}

	function removeItem(id: string): void {
		store.setState((prev) => ({
			items: prev.items.filter((i) => i.id !== id),
		}));
	}

	function updateItem(id: string, patch: Partial<T>): void {
		store.setState((prev) => ({
			items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
		}));
	}

	return {
		addItem,
		def,
		hydrateStore,
		removeItem,
		store,
		updateItem,
	};
}
