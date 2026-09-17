import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

import { onStorageKey, readStorage, writeStorage } from "./persist.ts";

export const SIDEBAR_WIDTH_KEY = "planner:sidebarWidth";
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;

export function clampSidebarWidth(value: number): number {
	if (!Number.isFinite(value)) return SIDEBAR_DEFAULT_WIDTH;
	return Math.min(
		SIDEBAR_MAX_WIDTH,
		Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)),
	);
}

function readStoredWidth(): number | null {
	const raw = readStorage(SIDEBAR_WIDTH_KEY);
	if (!raw) return null;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return null;
	return clampSidebarWidth(parsed);
}

/**
 * Resizable desktop sidebar width (`AppSidebar`, `md+` only).
 * Persists to `localStorage` + cross-tab syncs, same pattern as `scope.ts`.
 * Initialized to the default so server and first client render match;
 * call `hydrateSidebarStore()` on mount to pick up the stored value.
 */
export const sidebarWidthStore = new Store<number>(SIDEBAR_DEFAULT_WIDTH);

let hydrated = false;

if (typeof window !== "undefined") {
	sidebarWidthStore.subscribe((value) => {
		writeStorage(SIDEBAR_WIDTH_KEY, String(value));
	});
	onStorageKey(SIDEBAR_WIDTH_KEY, (raw) => {
		if (raw === null) return;
		const parsed = Number(raw);
		if (Number.isFinite(parsed)) {
			sidebarWidthStore.setState(() => clampSidebarWidth(parsed));
		}
	});
}

/** Hydrate once on the client. Safe to call repeatedly; no-ops after first load. */
export function hydrateSidebarStore() {
	if (typeof window === "undefined") return;
	if (hydrated) return;
	hydrated = true;
	const stored = readStoredWidth();
	if (stored !== null) sidebarWidthStore.setState(() => stored);
}

export function setSidebarWidth(value: number) {
	sidebarWidthStore.setState(() => clampSidebarWidth(value));
}

export function useSidebarWidth(): number {
	return useSelector(sidebarWidthStore, (s) => s);
}
