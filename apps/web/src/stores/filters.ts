import { useCreateStore, useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import { useEffect, useState } from "react";

/**
 * Debounced value backed by a component-scoped TanStack Store.
 * The input stays immediate (typing never blocks); `debounced` lags by `delayMs`
 * and is what feeds queries / URL commits. Single primitive for every list.
 */
export function useDebouncedStoreValue<T>(value: T, delayMs = 200): T {
	const debouncedStore = useCreateStore<T>(value);

	useEffect(() => {
		const t = setTimeout(() => {
			debouncedStore.setState(() => value);
		}, delayMs);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, delayMs]);

	return useSelector(debouncedStore, (s) => s);
}

/**
 * URL-synced search input.
 * - `input` is immediate for the <Input> value.
 * - Commits debounced to the router URL (shareable, survives reload).
 * - Re-syncs from the URL when it changes externally (back/forward, tab switch).
 */
export function useUrlSearchInput(args: {
	delayMs?: number;
	onCommit: (q: string | undefined) => void;
	urlQ: string | undefined;
}): [string, (v: string) => void] {
	const delay = args.delayMs ?? 250;
	const [inputStore] = useState(() => new Store(args.urlQ ?? ""));

	// External URL change (back/forward/clear) wins over in-flight typing.
	useEffect(() => {
		const url = args.urlQ ?? "";
		if (inputStore.state !== url) {
			// Avoid clobbering mid-keystroke: only sync when the URL moved
			// without a pending local commit. The commit effect below always
			// converges, so a simple equality guard is sufficient.
			inputStore.setState(() => url);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [args.urlQ]);

	const input = useSelector(inputStore, (s) => s);
	const debounced = useDebouncedStoreValue(input, delay);
	const [lastCommitted, setLastCommitted] = useState(args.urlQ ?? "");

	useEffect(() => {
		const next = debounced === "" ? undefined : debounced;
		const prev = lastCommitted === "" ? undefined : lastCommitted;
		if (next !== prev) {
			setLastCommitted(debounced);
			args.onCommit(next);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debounced]);

	return [input, (v: string) => inputStore.setState(() => v)];
}

/** Local (non-URL) search input with a debounced query value for data fetching. */
export function useLocalSearchInput(
	initial = "",
	delayMs = 200,
): {
	input: string;
	query: string | undefined;
	setInput: (v: string) => void;
} {
	const [inputStore] = useState(() => new Store(initial));
	const input = useSelector(inputStore, (s) => s);
	const debounced = useDebouncedStoreValue(input, delayMs);
	return {
		input,
		query: debounced === "" ? undefined : debounced,
		setInput: (v: string) => inputStore.setState(() => v),
	};
}
