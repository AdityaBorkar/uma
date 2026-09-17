"use client";
// beui.dev/components/motion/animated-badge

import {
	AlertTriangle,
	Check,
	Circle,
	Info,
	LoaderCircle,
	type LucideIcon,
	X,
} from "lucide-react";
import {
	AnimatePresence,
	type HTMLMotionProps,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import type { ReactNode } from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

export type AnimatedBadgeStatus =
	| "neutral"
	| "info"
	| "success"
	| "warning"
	| "danger"
	| "loading";

export type AnimatedBadgeSize = "sm" | "md";

export interface AnimatedBadgeProps
	extends Omit<HTMLMotionProps<"span">, "children"> {
	children?: ReactNode;
	contentKey?: string | number;
	icon?: ReactNode;
	pulse?: boolean;
	showIcon?: boolean;
	size?: AnimatedBadgeSize;
	status?: AnimatedBadgeStatus;
}

const STATUS_CLASS: Record<AnimatedBadgeStatus, string> = {
	danger: "border-destructive/30 bg-destructive/10 text-destructive",
	info: "border-primary/30 bg-primary/10 text-primary",
	loading: "border-primary/30 bg-primary/10 text-primary",
	neutral: "border-border bg-card text-muted-foreground",
	success:
		"border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	warning:
		"border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const SIZE_CLASS: Record<AnimatedBadgeSize, string> = {
	md: "h-8 gap-2 px-3 text-xs",
	sm: "h-6 gap-1.5 px-2 text-[11px]",
};

const ICON_CLASS: Record<AnimatedBadgeSize, string> = {
	md: "h-3.5 w-3.5",
	sm: "h-3 w-3",
};

const ICONS: Record<AnimatedBadgeStatus, LucideIcon> = {
	danger: X,
	info: Info,
	loading: LoaderCircle,
	neutral: Circle,
	success: Check,
	warning: AlertTriangle,
};

const ICON_ROLL_VARIANTS: Variants = {
	animate: {
		filter: "blur(0px)",
		opacity: 1,
		rotate: 0,
		scale: 1,
		transition: {
			filter: { duration: 0.42, ease: EASE_OUT },
			opacity: { duration: 0.28, ease: EASE_OUT },
			rotate: { duration: 0.28, ease: EASE_OUT },
			scale: { damping: 24, mass: 0.75, stiffness: 250, type: "spring" },
			y: { damping: 24, mass: 0.85, stiffness: 210, type: "spring" },
		},
		y: "0%",
	},
	exit: {
		filter: "blur(6px)",
		opacity: 0.5,
		rotate: 8,
		scale: 0.96,
		transition: { duration: 0.22, ease: EASE_OUT },
		y: "-80%",
	},
	initial: {
		filter: "blur(6px)",
		opacity: 0.72,
		rotate: -8,
		scale: 0.92,
		y: "80%",
	},
};

const TEXT_ROLL_VARIANTS: Variants = {
	animate: {
		filter: "blur(0px)",
		opacity: 1,
		transition: {
			filter: { duration: 0.42, ease: EASE_OUT },
			opacity: { duration: 0.3, ease: EASE_OUT },
			y: { damping: 24, mass: 0.85, stiffness: 210, type: "spring" },
		},
		y: "0%",
	},
	exit: {
		filter: "blur(6px)",
		opacity: 0.5,
		transition: { duration: 0.2, ease: EASE_OUT },
		y: "-85%",
	},
	initial: { filter: "blur(6px)", opacity: 0.76, y: "85%" },
};

export function AnimatedBadge({
	status = "neutral",
	size = "md",
	children,
	icon,
	showIcon = true,
	pulse = status === "loading",
	contentKey,
	className,
	...rest
}: AnimatedBadgeProps) {
	const reduce = useReducedMotion();
	const Icon = ICONS[status];
	const resolvedContentKey =
		contentKey ??
		(typeof children === "string" || typeof children === "number"
			? children
			: status);

	return (
		<motion.span
			className={cn(
				"relative inline-flex shrink-0 items-center overflow-hidden whitespace-nowrap rounded-full border font-medium tabular-nums",
				"transition-colors duration-300",
				STATUS_CLASS[status],
				SIZE_CLASS[size],
				className,
			)}
			layout
			transition={{ damping: 30, mass: 0.7, stiffness: 420, type: "spring" }}
			{...rest}
		>
			{pulse && !reduce ? (
				<motion.span
					animate={{ opacity: [0.08, 0.16, 0.08], scale: [0.94, 1.08, 0.94] }}
					aria-hidden
					className="absolute inset-0 rounded-full bg-current opacity-10"
					transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
				/>
			) : null}
			{showIcon ? (
				<span className="relative z-10 inline-flex items-center justify-center overflow-hidden">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.span
							animate={reduce ? { opacity: 1 } : "animate"}
							aria-hidden
							className="inline-flex will-change-transform"
							data-badge-icon
							// exactOptionalPropertyTypes: opacity-only exit instead of undefined.
							exit={reduce ? { opacity: 0 } : "exit"}
							initial={reduce ? false : "initial"}
							key={status}
							variants={ICON_ROLL_VARIANTS}
						>
							{status === "loading" && !reduce && !icon ? (
								<motion.span
									animate={{ rotate: 360 }}
									className="inline-flex"
									transition={{ duration: 1, ease: "linear", repeat: Infinity }}
								>
									<Icon className={ICON_CLASS[size]} />
								</motion.span>
							) : (
								(icon ?? <Icon className={ICON_CLASS[size]} />)
							)}
						</motion.span>
					</AnimatePresence>
				</span>
			) : null}
			{children != null ? (
				<span className="relative z-10 inline-flex overflow-hidden">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.span
							animate={reduce ? { opacity: 1 } : "animate"}
							className="inline-block will-change-transform"
							data-badge-label
							// exactOptionalPropertyTypes: opacity-only exit instead of undefined.
							exit={reduce ? { opacity: 0 } : "exit"}
							initial={reduce ? false : "initial"}
							key={resolvedContentKey}
							variants={TEXT_ROLL_VARIANTS}
						>
							{children}
						</motion.span>
					</AnimatePresence>
				</span>
			) : null}
		</motion.span>
	);
}
