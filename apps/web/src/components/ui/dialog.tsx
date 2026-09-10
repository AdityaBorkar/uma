import type * as React from "react";

import { X } from "#/components/icons.tsx";
import { cn } from "#/lib/utils";

interface DialogProps {
	children: React.ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				aria-label="Close"
				className="absolute inset-0 bg-[#24292f]/50 backdrop-blur-[1px]"
				onClick={() => onOpenChange(false)}
				type="button"
			/>
			<div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto px-4">
				{children}
			</div>
		</div>
	);
}

function DialogContent({
	className,
	children,
	onClose,
	...props
}: React.ComponentProps<"div"> & { onClose?: () => void }) {
	return (
		<div
			className={cn(
				"bg-card text-card-foreground relative rounded-md border shadow-sm",
				className,
			)}
			data-slot="dialog-content"
			{...props}
		>
			{onClose ? (
				<button
					aria-label="Close"
					className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none"
					onClick={onClose}
					type="button"
				>
					<X className="size-4.25" />
				</button>
			) : null}
			{children}
		</div>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-col space-y-1 border-b bg-muted/50 px-4 py-3 text-left rounded-t-md",
				className,
			)}
			{...props}
		/>
	);
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			className={cn("text-sm font-semibold leading-none", className)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p className={cn("text-xs text-muted-foreground", className)} {...props} />
	);
}

export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle };
