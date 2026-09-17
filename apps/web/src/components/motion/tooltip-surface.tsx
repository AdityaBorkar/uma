"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { type ComponentProps, type ReactNode, type Ref, useMemo } from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

type Side = "top" | "right" | "bottom" | "left";

// Offset is in the direction *away* from the trigger — content originates near
// the trigger and rises into resting position.
const offsetFrom: Record<Side, { x?: number; y?: number }> = {
	bottom: { y: -8 },
	left: { x: 8 },
	right: { x: -8 },
	top: { y: 8 },
};

// Small tooltip surfaces need the lighter spawn used by the original Tooltip.
const TOOLTIP_SPRING = {
	damping: 30,
	mass: 0.7,
	stiffness: 380,
	type: "spring",
} as const;

function buildVariants(side: Side): Variants {
	const o = offsetFrom[side];
	return {
		animate: {
			filter: "blur(0px)",
			opacity: 1,
			scale: 1,
			transition: {
				...TOOLTIP_SPRING,
				filter: { duration: 0.18, ease: EASE_OUT },
				opacity: { duration: 0.14, ease: EASE_OUT },
			},
			x: 0,
			y: 0,
		},
		exit: {
			filter: "blur(3px)",
			opacity: 0,
			scale: 0.94,
			transition: { duration: 0.12, ease: EASE_OUT },
			x: (o.x ?? 0) * 0.6,
			y: (o.y ?? 0) * 0.6,
		},
		initial: {
			filter: "blur(5px)",
			opacity: 0,
			scale: 0.9,
			x: o.x ?? 0,
			y: o.y ?? 0,
		},
	};
}

const REDUCED_VARIANTS: Variants = {
	animate: { opacity: 1, transition: { duration: 0.14, ease: EASE_OUT } },
	exit: { opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } },
	initial: { opacity: 0 },
};

/** The shared visual surface for trigger tooltips and chart readouts. Positioning belongs to the caller. */
export function TooltipSurface({
	children,
	side = "top",
	className,
	ref,
	...props
}: Omit<ComponentProps<typeof motion.span>, "children"> & {
	children?: ReactNode;
	side?: Side;
	ref?: Ref<HTMLSpanElement>;
}) {
	const reduce = useReducedMotion();
	const variants = useMemo(
		() => (reduce ? REDUCED_VARIANTS : buildVariants(side)),
		[reduce, side],
	);
	return (
		<motion.span
			animate="animate"
			className={cn(
				"block whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-lg",
				className,
			)}
			exit="exit"
			initial="initial"
			ref={ref}
			role="tooltip"
			variants={variants}
			{...props}
		>
			{children}
		</motion.span>
	);
}
