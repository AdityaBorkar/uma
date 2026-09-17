"use client";
// beui.dev/components/motion/morphing-modal

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect } from "react";

import { EASE_OUT, SPRING_PANEL } from "#/lib/ease.ts";
import { PresenceGate } from "#/lib/presence-gate.tsx";
import { cn } from "#/lib/utils.ts";

export interface MorphingModalProps {
	children: ReactNode;
	className?: string;
	onClose: () => void;
	/** "bottom" anchors to the viewport bottom (mobile-like). "center" centers vertically. */
	placement?: "bottom" | "center";
	/** Which view is currently shown. `null` closes the modal. */
	viewId: string | null;
}

export function MorphingModal({
	viewId,
	onClose,
	children,
	placement = "bottom",
	className,
}: MorphingModalProps) {
	const open = viewId !== null;
	const reduce = useReducedMotion();
	const enterY = reduce ? 0 : placement === "bottom" ? 40 : 20;
	const enterScale = reduce ? 1 : 0.97;

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	// Mounted only while open, and while open the chrome is two fixed siblings
	// rather than one wrapper: the backdrop spans the viewport edges but carries
	// the scrim colour, and the layer positioning the panel sits inset off every
	// edge (`inset-4`, with the bottom placement's `pb-4` on top of it). Both hang
	// off `PresenceGate`, so interaction releases in the same commit that starts
	// the exit rather than when it ends — `open` is already false for those
	// frames. See tests/fixed-overlay-edge-sampling.test.tsx.
	return (
		<AnimatePresence initial={false}>
			{open ? (
				<PresenceGate key="backdrop">
					{({ gate }) => (
						<motion.button
							animate={{ opacity: 1 }}
							aria-label="Close modal"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							transition={{ duration: 0.2, ease: EASE_OUT }}
							type="button"
							{...gate}
							className="pointer-events-auto fixed inset-0 z-[80] bg-background/5 [backdrop-filter:blur(14px)_saturate(140%)] [-webkit-backdrop-filter:blur(14px)_saturate(140%)]"
							onClick={onClose}
						/>
					)}
				</PresenceGate>
			) : null}

			{open ? (
				<PresenceGate key="panel-layer">
					{({ isPresent, gate }) => (
						// The layer itself never takes pointer events, so it carries
						// `inert` alone rather than the gate's pointer-events value.
						<div
							className={cn(
								"pointer-events-none fixed inset-4 z-[80] flex justify-center",
								placement === "bottom" ? "items-end pb-4" : "items-center",
							)}
							inert={!isPresent}
						>
							<motion.div
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{
									opacity: 0,
									scale: reduce ? 1 : 0.98,
									transition: { duration: 0.18, ease: EASE_OUT },
									y: enterY,
								}}
								initial={{ opacity: 0, scale: enterScale, y: enterY }}
								key="panel"
								layout
								transition={SPRING_PANEL}
								{...gate}
								className={cn(
									"pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-2xl will-change-transform",
									className,
								)}
							>
								<motion.div className="p-5" layout="position">
									<AnimatePresence initial={false} mode="popLayout">
										<motion.div
											animate={
												reduce
													? {
															opacity: 1,
															transition: {
																duration: 0.18,
																ease: EASE_OUT,
															},
														}
													: {
															filter: "blur(0px)",
															opacity: 1,
															transition: {
																duration: 0.24,
																ease: EASE_OUT,
															},
															y: 0,
														}
											}
											exit={
												reduce
													? {
															opacity: 0,
															transition: {
																duration: 0.14,
																ease: EASE_OUT,
															},
														}
													: {
															filter: "blur(4px)",
															opacity: 0,
															transition: {
																duration: 0.16,
																ease: EASE_OUT,
															},
															y: -8,
														}
											}
											initial={
												reduce
													? { opacity: 0 }
													: { filter: "blur(4px)", opacity: 0, y: 8 }
											}
											key={viewId}
										>
											{children}
										</motion.div>
									</AnimatePresence>
								</motion.div>
							</motion.div>
						</div>
					)}
				</PresenceGate>
			) : null}
		</AnimatePresence>
	);
}
