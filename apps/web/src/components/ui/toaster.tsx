import * as React from "react";

import { cn } from "#/lib/utils.ts";

type Toast = {
	id: string;
	title: string;
	description?: string;
	variant?: "default" | "destructive";
};

const ToastContext = React.createContext<{
	toasts: Toast[];
	toast: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
	const ctx = React.useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within ToastProvider");
	return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = React.useState<Toast[]>([]);
	const toast = (t: Omit<Toast, "id">) => {
		const id = crypto.randomUUID();
		setToasts((prev) => [...prev, { ...t, id }]);
		setTimeout(
			() => setToasts((prev) => prev.filter((x) => x.id !== id)),
			3000,
		);
	};
	return (
		<ToastContext.Provider value={{ toast, toasts }}>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
				{toasts.map((t) => (
					<div
						className={cn(
							"rounded-lg border px-4 py-3 shadow-lg bg-card text-card-foreground min-w-[280px]",
							t.variant === "destructive" &&
								"border-destructive bg-destructive text-destructive-foreground",
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
		</ToastContext.Provider>
	);
}
