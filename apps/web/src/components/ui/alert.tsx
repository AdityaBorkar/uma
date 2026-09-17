import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

const alertVariants = cva(
	"relative w-full rounded-md border px-4 py-3 text-sm grid alert-grid has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "bg-card text-card-foreground border-border",
				destructive:
					"bg-danger-bg border-danger-edge/30 text-danger-fg [&>svg]:text-current *:data-[slot=alert-description]:text-current/90",
			},
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ variant }), className)}
			data-slot="alert"
			role="alert"
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"col-start-2 line-clamp-1 min-h-4 font-semibold text-sm tracking-tight",
				className,
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
				className,
			)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
