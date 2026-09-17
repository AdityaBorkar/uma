import type { ReactNode } from "react";

import { Button } from "#/components/ui/button.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table.tsx";
import { formatAgo } from "#/lib/age.ts";
import { cn } from "#/lib/utils.ts";

/**
 * Shared table shell. TaskTable and SignalTable shared the same
 * `Table > TableHeader > TableRow bg-muted/50` header, muted meta cells
 * with `?? "—"` fallback, `formatAgo()` dates and right-aligned
 * `size="sm"` action cells.
 */

export function DataTable({ children }: { children: ReactNode }) {
	return <Table>{children}</Table>;
}

export function DataTableHeader({ children }: { children: ReactNode }) {
	return (
		<TableHeader>
			<TableRow className="bg-muted/50 hover:bg-muted/50">{children}</TableRow>
		</TableHeader>
	);
}

export function DataTableHead({
	children,
	className,
	right,
}: {
	children: ReactNode;
	className?: string | undefined;
	right?: boolean | undefined;
}) {
	return (
		<TableHead className={cn(className, right && "text-right")}>
			{children}
		</TableHead>
	);
}

export function DataTableBody({ children }: { children: ReactNode }) {
	return <TableBody>{children}</TableBody>;
}

export function DataTableMetaCell({ children }: { children: ReactNode }) {
	return (
		<TableCell className="text-muted-foreground text-sm">{children}</TableCell>
	);
}

export function DataTableAgoCell({ value }: { value: string | Date }) {
	return (
		<TableCell className="text-muted-foreground text-sm">
			{formatAgo(value)}
		</TableCell>
	);
}

export function DataTableTitleCell({
	subtitle,
	title,
}: {
	subtitle?: ReactNode;
	title: ReactNode;
}) {
	return (
		<TableCell>
			<div className="font-medium text-sm">{title}</div>
			{subtitle ? (
				<p className="text-muted-foreground text-xs">{subtitle}</p>
			) : null}
		</TableCell>
	);
}

export function DataTableActionsCell({ children }: { children: ReactNode }) {
	return (
		<TableCell className="text-right">
			<div className="flex justify-end gap-1">{children}</div>
		</TableCell>
	);
}

export function DataTableAction({
	children,
	disabled,
	onClick,
	variant = "outline",
}: {
	children: ReactNode;
	disabled?: boolean | undefined;
	onClick: () => void;
	variant?: "outline" | "ghost" | undefined;
}) {
	return (
		<Button disabled={disabled} onClick={onClick} size="sm" variant={variant}>
			{children}
		</Button>
	);
}

export function fallbackText(value: string | null | undefined): string {
	return value ?? "—";
}
