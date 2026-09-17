import type { ReactNode } from "react";

import { cn } from "#/lib/utils.ts";

/**
 * Shared list row shell. Verbatim row class previously copied across
 * agents/machines/skills/prompt-templates/subagents/mcp-servers/
 * version-source: `flex flex-col gap-2 border-b px-4 py-3 last:border-0
 * sm:flex-row sm:items-center sm:justify-between`.
 */
export function ListRow({
	children,
	className,
}: {
	children: ReactNode;
	className?: string | undefined;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function ListRowMain({
	children,
	className,
}: {
	children: ReactNode;
	className?: string | undefined;
}) {
	return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function ListRowActions({
	children,
	className,
}: {
	children: ReactNode;
	className?: string | undefined;
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function ListRowTitle({
	children,
	mono,
}: {
	children: ReactNode;
	mono?: boolean | undefined;
}) {
	return (
		<p className={cn("font-semibold text-sm", mono && "font-mono")}>
			{children}
		</p>
	);
}

export function ListRowSubtitle({ children }: { children: ReactNode }) {
	return <p className="truncate text-muted-foreground text-sm">{children}</p>;
}
