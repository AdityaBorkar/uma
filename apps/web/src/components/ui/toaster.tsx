import { useSelector } from "@tanstack/react-store";

import { cn } from "#/lib/utils.ts";
import { toast, toastStore } from "#/stores/toast.ts";

export type { ToastItem as Toast } from "#/stores/toast.ts";
export { toast };

/** Store-backed hook. No provider required (kept name for existing imports). */
export function useToast() {
	const toasts = useSelector(toastStore, (s) => s);
	return { toast, toasts };
}

/** Viewport + children. No context — state lives in `toastStore`. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const toasts = useSelector(toastStore, (s) => s);
	return (
		<>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						className={cn(
							"rounded-md border px-4 py-3 bg-card text-card-foreground min-w-70",
							t.variant === "destructive" &&
								"border-danger-edge/30 bg-danger-bg text-danger-fg",
						)}
						key={t.id}
					>
						<div className="text-sm font-medium">{t.title}</div>
						{t.description ? (
							<div className="text-xs opacity-80">{t.description}</div>
						) : null}
					</div>
				))}
			</div>
		</>
	);
}
