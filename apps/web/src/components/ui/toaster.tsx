import { useSelector } from "@tanstack/react-store";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";
import { dismissToast, toast, toastStore } from "#/stores/toast.ts";

export type { ToastItem as Toast } from "#/stores/toast.ts";
export { dismissToast, toast };

const STACK_SPRING = {
	damping: 34,
	mass: 0.75,
	stiffness: 420,
	type: "spring",
} as const;

/** Store-backed hook. No provider required (kept name for existing imports). */
export function useToast() {
	const toasts = useSelector(toastStore, (s) => s);
	return { dismissToast, toast, toasts };
}

/** Viewport + children. No context — state lives in `toastStore`. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const toasts = useSelector(toastStore, (s) => s);
	const reduce = useReducedMotion();
	return (
		<>
			{children}
			<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
				{/* beUI toast-stack language
				    (beui.dev/components/motion/animated-toast-stack): toasts
				    spawn with a blur rise on a layout-aware spring, leave with
				    a fast blur slide, and swipe away on drag. Reduced motion
				    collapses to opacity-only with no swipe. */}
				<AnimatePresence initial={false} mode="popLayout">
					{toasts.map((t) => (
						<motion.div
							animate={
								reduce
									? { opacity: 1 }
									: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 }
							}
							className={cn(
								"rounded-md border px-4 py-3 bg-card text-card-foreground min-w-70 will-change-transform",
								t.variant === "destructive" &&
									"border-danger-edge/30 bg-danger-bg text-danger-fg",
							)}
							drag={reduce ? false : "x"}
							dragConstraints={{ left: 0, right: 0 }}
							dragElastic={0.18}
							exit={
								reduce
									? { opacity: 0 }
									: {
											filter: "blur(8px)",
											opacity: 0,
											scale: 0.96,
											transition: { duration: 0.18, ease: EASE_OUT },
											x: 32,
										}
							}
							initial={
								reduce
									? { opacity: 0 }
									: { filter: "blur(10px)", opacity: 0, scale: 0.96, y: 22 }
							}
							key={t.id}
							layout
							onDragEnd={(_, info) => {
								if (reduce) return;
								if (
									Math.abs(info.offset.x) > 72 ||
									Math.abs(info.velocity.x) > 520
								) {
									dismissToast(t.id);
								}
							}}
							transition={STACK_SPRING}
						>
							<div className="text-sm font-medium">{t.title}</div>
							{t.description ? (
								<div className="text-xs opacity-80">{t.description}</div>
							) : null}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</>
	);
}
