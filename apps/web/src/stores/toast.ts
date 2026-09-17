import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

export interface ToastItem {
	description?: string;
	id: string;
	title: string;
	variant?: "default" | "destructive";
}

const MAX_TOASTS = 5;

/** Global toast list. Replaces the former ToastContext + useState array. */
export const toastStore = new Store<ToastItem[]>([]);

export function dismissToast(id: string) {
	toastStore.setState((prev) => prev.filter((t) => t.id !== id));
}

export function toast(t: Omit<ToastItem, "id">) {
	const id = crypto.randomUUID();
	toastStore.setState((prev) => [
		...prev.slice(-(MAX_TOASTS - 1)),
		{ ...t, id },
	]);
	window.setTimeout(() => dismissToast(id), 3000);
}

export function useToasts(): ToastItem[] {
	return useSelector(toastStore, (s) => s);
}

/**
 * Store-backed replacement for the old Context `useToast()`.
 * No provider required; safe to call anywhere under `__root`.
 */
export function useToast() {
	const toasts = useToasts();
	return { toast, toasts };
}
