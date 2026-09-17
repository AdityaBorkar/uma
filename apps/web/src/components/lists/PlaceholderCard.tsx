import type { ReactNode } from "react";

/**
 * Single-line muted placeholder box. Replaces identical
 * `rounded-md border bg-muted/30 px-4 py-6 text-center` boxes in
 * monitor/evals/analytics.
 */
export function PlaceholderCard({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm">
			{children}
		</div>
	);
}
