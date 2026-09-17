/** Shared persistence helpers for TanStack Store singletons. */

export function isBrowser(): boolean {
	return typeof window !== "undefined" && !!window.localStorage;
}

export function readStorage(key: string): string | null {
	try {
		if (!isBrowser()) return null;
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeStorage(key: string, value: string): void {
	try {
		if (!isBrowser()) return;
		window.localStorage.setItem(key, value);
	} catch {
		// Storage full or unavailable — pages keep working in memory.
	}
}

/**
 * Subscribe a callback to cross-tab `storage` events for `key`.
 * Returns an unsubscribe function. No-op on the server.
 */
export function onStorageKey(key: string, cb: (raw: string | null) => void) {
	if (typeof window === "undefined") return () => {};
	const handler = (e: StorageEvent) => {
		if (e.key === key) cb(e.newValue);
	};
	window.addEventListener("storage", handler);
	return () => window.removeEventListener("storage", handler);
}
