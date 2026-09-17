import type { VariantProps } from "class-variance-authority";
import {
	AnimatePresence,
	type HTMLMotionProps,
	motion,
	useReducedMotion,
} from "motion/react";
import * as React from "react";

import { badgeVariants } from "#/components/ui/badge-variants.ts";
import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

function Badge({
	children,
	className,
	variant,
	asChild = false,
	contentKey,
	...props
}: HTMLMotionProps<"span"> &
	VariantProps<typeof badgeVariants> & {
		asChild?: boolean;
		contentKey?: string | number | undefined;
	}) {
	const reduce = useReducedMotion();
	if (asChild && React.isValidElement(children)) {
		const child = children as React.ReactElement<{
			className?: string;
		}>;
		return React.cloneElement(child, {
			className: cn(
				badgeVariants({ variant }),
				className,
				(child.props as { className?: string }).className,
			),
		} as React.Attributes & Record<string, unknown>);
	}

	const resolvedKey =
		contentKey ??
		(typeof children === "string" || typeof children === "number"
			? children
			: (variant ?? "default"));

	// beUI animated badge (beui.dev/components/motion/animated-badge): the
	// shell keeps its footprint while changing width on a spring, and the
	// content rolls over with a short blur slide. Reduced motion collapses to
	// an opacity crossfade.
	return (
		<motion.span
			className={cn(badgeVariants({ variant }), "tabular-nums", className)}
			data-slot="badge"
			layout={!reduce}
			transition={{ damping: 30, mass: 0.7, stiffness: 420, type: "spring" }}
			{...props}
		>
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					animate={
						reduce
							? { opacity: 1 }
							: { filter: "blur(0px)", opacity: 1, y: "0%" }
					}
					className="inline-flex items-center gap-1 will-change-transform [&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0"
					exit={
						reduce
							? { opacity: 0 }
							: { filter: "blur(6px)", opacity: 0.5, y: "-85%" }
					}
					initial={
						reduce
							? { opacity: 0 }
							: { filter: "blur(6px)", opacity: 0.76, y: "85%" }
					}
					key={resolvedKey}
					transition={
						reduce
							? { duration: 0.15 }
							: {
									filter: { duration: 0.42, ease: EASE_OUT },
									opacity: { duration: 0.3, ease: EASE_OUT },
									y: {
										damping: 24,
										mass: 0.85,
										stiffness: 210,
										type: "spring",
									},
								}
					}
				>
					{children}
				</motion.span>
			</AnimatePresence>
		</motion.span>
	);
}

export { Badge };
