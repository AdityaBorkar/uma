import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			className="relative w-full overflow-x-auto"
			data-slot="table-container"
		>
			<table
				className={cn("w-full caption-bottom text-sm", className)}
				data-slot="table"
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			className={cn("bg-muted/50 [&_tr]:border-b", className)}
			data-slot="table-header"
			{...props}
		/>
	);
}

function TableBody({
	children,
	className,
	...props
}: React.ComponentProps<"tbody">) {
	// Tables opt into the beUI table language (minimal, reduced-motion-safe)
	// automatically: each body row fades in with a small capped stagger so
	// list updates read as a content reveal, never as layout churn.
	const staggered = React.Children.map(children, (child, index) => {
		if (
			React.isValidElement(child) &&
			child.type === TableRow &&
			typeof (child.props as { staggerIndex?: unknown }).staggerIndex ===
				"undefined"
		) {
			return React.cloneElement(
				child as React.ReactElement<{
					staggerIndex?: number | undefined;
				}>,
				{ staggerIndex: index },
			);
		}
		return child;
	});
	return (
		<tbody
			className={cn("[&_tr:last-child]:border-0", className)}
			data-slot="table-body"
			{...props}
		>
			{staggered}
		</tbody>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			className={cn(
				"border-t bg-muted font-medium [&>tr]:last:border-b-0",
				className,
			)}
			data-slot="table-footer"
			{...props}
		/>
	);
}

function TableRow({
	className,
	staggerIndex,
	...props
}: HTMLMotionProps<"tr"> & {
	staggerIndex?: number | undefined;
}) {
	const reduce = useReducedMotion();
	// Opacity-only: CSS transforms do not reliably apply to `display:
	// table-row`, so rows reveal with opacity while the stagger delay keeps
	// the cascade under 300ms total. Reduced motion removes the delay.
	return (
		<motion.tr
			className={cn(
				"border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			data-slot="table-row"
			{...(staggerIndex === undefined
				? {}
				: {
						animate: { opacity: 1 },
						initial: { opacity: 0 },
						transition: {
							delay: reduce ? 0 : Math.min(staggerIndex * 0.015, 0.15),
							duration: 0.18,
							ease: EASE_OUT,
						},
					})}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			className={cn(
				"h-8 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-0.5",
				className,
			)}
			data-slot="table-head"
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			className={cn(
				"px-3 py-2 align-middle text-sm [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-0.5",
				className,
			)}
			data-slot="table-cell"
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			className={cn("mt-4 text-xs text-muted-foreground", className)}
			data-slot="table-caption"
			{...props}
		/>
	);
}

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
