import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect } from "react";

import { X } from "#/components/icons.tsx";
import { EASE_OUT, SPRING_PANEL } from "#/lib/ease.ts";
import { PresenceGate } from "#/lib/presence-gate.tsx";
import { cn } from "#/lib/utils.ts";

interface DialogProps {
	children: React.ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
	const reduce = useReducedMotion();

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onOpenChange(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = prev;
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open, onOpenChange]);

	// beUI center-morph language (beui.dev/components/motion/center-morph-modal):
	// the scrim fades while the panel unfolds on a spring, and the panel keeps
	// a shared-layout footprint so height changes morph instead of snapping.
	// Reduced motion collapses to opacity-only. PresenceGate releases
	// interaction in the same commit the exit starts.
	return (
		<AnimatePresence initial={false}>
			{open ? (
				<PresenceGate key="backdrop">
					{({ gate }) => (
						<motion.button
							animate={{ opacity: 1 }}
							aria-label="Close"
							className="fixed inset-0 z-50 bg-overlay/50 backdrop-blur-subtle"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							onClick={() => onOpenChange(false)}
							transition={{ duration: 0.2, ease: EASE_OUT }}
							type="button"
							{...gate}
						/>
					)}
				</PresenceGate>
			) : null}

			{open ? (
				<PresenceGate key="panel">
					{({ gate, isPresent }) => (
						<div
							className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
							inert={!isPresent}
						>
							<div className="relative dialog-frame w-full max-w-lg overflow-auto px-4">
								<motion.div
									animate={{ opacity: 1, scale: 1, y: 0 }}
									className="pointer-events-auto will-change-transform"
									exit={{
										opacity: 0,
										scale: reduce ? 1 : 0.98,
										transition: { duration: 0.18, ease: EASE_OUT },
										y: reduce ? 0 : 12,
									}}
									initial={{
										opacity: 0,
										scale: reduce ? 1 : 0.97,
										y: reduce ? 0 : 20,
									}}
									layout
									transition={SPRING_PANEL}
									{...gate}
								>
									{children}
								</motion.div>
							</div>
						</div>
					)}
				</PresenceGate>
			) : null}
		</AnimatePresence>
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
				"bg-card text-card-foreground relative rounded-md border",
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
