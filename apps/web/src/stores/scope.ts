import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

import { onStorageKey, readStorage, writeStorage } from "./persist.ts";

export const LAST_SCOPE_KEY = "planner:lastScope";

/**
 * Last-visited project scope (`slug` or `"~"`).
 * Single writer: `$projectSlug` layout route. Single reader: `AppShell` fallback.
 * Persistence + cross-tab sync live here instead of scattered useEffects.
 */
export const lastScopeStore = new Store<string | null>(null);

function persistScope(value: string | null) {
	if (value === null) return;
	writeStorage(LAST_SCOPE_KEY, value);
}

if (typeof window !== "undefined") {
	lastScopeStore.subscribe(persistScope);
	onStorageKey(LAST_SCOPE_KEY, (raw) => {
		if (raw) lastScopeStore.setState(() => raw);
	});
}

/** Hydrate once on the client. Safe to call repeatedly; no-ops after first load. */
export function hydrateScopeStore() {
	if (typeof window === "undefined") return;
	if (lastScopeStore.state !== null) return;
	const raw = readStorage(LAST_SCOPE_KEY);
	if (raw) lastScopeStore.setState(() => raw);
}

export function setLastScope(slug: string) {
	lastScopeStore.setState(() => slug);
}

export function useLastScope(): string | null {
	return useSelector(lastScopeStore, (s) => s);
}

/** Resolve display scope: workspace wins, then URL override, then stored, then multi. */
export function resolveCurrentScope(args: {
	scopeOverride?: string;
	storedScope: string | null;
	workspaceSlug?: string;
}): string {
	return args.workspaceSlug ?? args.scopeOverride ?? args.storedScope ?? "~";
}
