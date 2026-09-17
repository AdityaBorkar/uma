"use client";
// beui.dev/components/motion/tabs
// Hover language: beui.dev/components/motion/shared-layout-bg — a second,
// subtle pill/underline glides between hovered triggers on its own layoutId
// while the active indicator keeps gliding on the primary one.

import {
	AnimatePresence,
	MotionConfig,
	motion,
	type Transition,
	useReducedMotion,
} from "motion/react";
import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useCallback,
	useContext,
	useId,
	useMemo,
	useState,
} from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { useHoverCapable } from "#/lib/hooks/use-hover-capable.ts";
import { cn } from "#/lib/utils.ts";

type Variant = "pill" | "underline" | "segment";

type Ctx = {
	value: string;
	setValue: (v: string) => void;
	layoutId: string;
	hoverLayoutId: string;
	hovered: string | null;
	setHovered: Dispatch<SetStateAction<string | null>>;
	canHover: boolean;
	variant: Variant;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
	const ctx = useContext(TabsCtx);
	if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
	return ctx;
}

// Settle without overshoot: a scrollable tab list would turn even a small
// overshoot into a transient scrollbar and layout shift.
const transition: Transition = {
	damping: 30,
	mass: 1.2,
	stiffness: 170,
	type: "spring",
};

export function Tabs({
	defaultValue,
	value,
	onValueChange,
	variant = "pill",
	children,
	className,
}: {
	defaultValue?: string;
	value?: string;
	onValueChange?: (v: string) => void;
	variant?: Variant;
	children: ReactNode;
	className?: string;
}) {
	const [internal, setInternal] = useState(defaultValue ?? "");
	const layoutId = useId();
	const hoverLayoutId = useId();
	const [hovered, setHovered] = useState<string | null>(null);
	const reduce = useReducedMotion();
	// Touch taps fire phantom `:hover` that sticks — only track the gliding
	// hover pill where a true hover exists. The pill stays unrendered on
	// touch, so no `setHovered` update there ever paints.
	const canHover = useHoverCapable();
	const controlled = value !== undefined;
	const current = controlled ? value : internal;
	const setValue = useCallback(
		(v: string) => {
			if (!controlled) setInternal(v);
			onValueChange?.(v);
		},
		[controlled, onValueChange],
	);
	const contextValue = useMemo(
		() => ({
			canHover,
			hovered,
			hoverLayoutId,
			layoutId,
			setHovered,
			setValue,
			value: current,
			variant,
		}),
		[canHover, current, hoverLayoutId, hovered, layoutId, setValue, variant],
	);
	return (
		<MotionConfig transition={reduce ? { duration: 0 } : transition}>
			<TabsCtx.Provider value={contextValue}>
				{/* layoutRoot: the indicator's layoutId measures in page coordinates, so
            inside fixed/scrolled containers it would replay scroll offsets as
            movement. The pill only ever travels within the list, so scoping
            projection to the Tabs wrapper is always correct. */}
				<motion.div className={className} layoutRoot>
					{children}
				</motion.div>
			</TabsCtx.Provider>
		</MotionConfig>
	);
}

const listClasses: Record<Variant, string> = {
	pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
	segment: "inline-flex items-center gap-0 rounded-lg bg-card p-0.5",
	underline: "inline-flex items-center gap-1 border-b border-border",
};

export function TabsList({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const { variant, setHovered } = useTabs();
	return (
		<div
			className={cn(listClasses[variant], className)}
			onMouseLeave={() => setHovered(null)}
			role="tablist"
		>
			{children}
		</div>
	);
}

export function TabsTrigger({
	value,
	children,
	className,
	indicatorClassName,
}: {
	value: string;
	children: ReactNode;
	className?: string;
	indicatorClassName?: string;
}) {
	const {
		value: current,
		setValue,
		layoutId,
		hoverLayoutId,
		hovered,
		setHovered,
		canHover,
		variant,
	} = useTabs();
	const active = current === value;
	// The hover pill only ever decorates an inactive trigger — the active
	// indicator already owns that surface.
	const showHover = canHover && !active && hovered === value;
	const clearHover = () => setHovered((cur) => (cur === value ? null : cur));

	if (variant === "underline") {
		return (
			<button
				aria-selected={active}
				className={cn(
					"relative isolate px-3 pb-2.5 pt-1 -mb-px text-sm font-medium transition-colors min-h-[44px] inline-flex items-center",
					active
						? "text-foreground"
						: "text-muted-foreground hover:text-foreground",
					className,
				)}
				onBlur={clearHover}
				onClick={() => setValue(value)}
				onFocus={() => setHovered(value)}
				onMouseEnter={() => setHovered(value)}
				onMouseLeave={clearHover}
				role="tab"
				type="button"
			>
				{children}
				{active ? (
					<motion.span
						className={cn(
							"absolute -bottom-px left-0 right-0 h-px bg-primary",
							indicatorClassName,
						)}
						layout="position"
						layoutId={layoutId}
					/>
				) : null}
				{/* Hover language: a muted underline glides between hovered tabs
				    on its own layoutId — opacity-only, so it stays quiet next
				    to the white active bar. */}
				<AnimatePresence>
					{showHover ? (
						<motion.span
							animate={{ opacity: 1 }}
							aria-hidden={true}
							className="absolute -bottom-px left-0 right-0 h-px bg-border"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							key="tab-hover"
							layout="position"
							layoutId={hoverLayoutId}
						/>
					) : null}
				</AnimatePresence>
			</button>
		);
	}

	const radius = variant === "pill" ? "rounded-full" : "rounded-md";

	return (
		<div className="relative">
			{active ? (
				<motion.span
					className={cn(
						"absolute inset-0 bg-primary",
						radius,
						indicatorClassName,
					)}
					layout="position"
					layoutId={layoutId}
					style={{ borderRadius: variant === "pill" ? 9999 : 8 }}
				/>
			) : null}
			{/* Hover language: a muted wash glides between hovered triggers on
			    its own layoutId, fading + de-blurring in (opacity-only under
			    reduced motion). */}
			<AnimatePresence>
				{showHover ? (
					<HoverPill key="tab-hover" layoutId={hoverLayoutId} radius={radius} />
				) : null}
			</AnimatePresence>
			<button
				aria-selected={active}
				className={cn(
					"relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none",
					"transition-colors",
					active
						? "text-primary-foreground"
						: "text-muted-foreground hover:text-foreground",
					radius,
					className,
				)}
				onBlur={clearHover}
				onClick={() => setValue(value)}
				onFocus={() => setHovered(value)}
				onMouseEnter={() => setHovered(value)}
				onMouseLeave={clearHover}
				role="tab"
				type="button"
			>
				{children}
			</button>
		</div>
	);
}

/** Shared-layout hover wash for pill/segment triggers (see `TabsTrigger`). */
function HoverPill({ layoutId, radius }: { layoutId: string; radius: string }) {
	const reduce = useReducedMotion();
	return (
		<motion.span
			animate={reduce ? { opacity: 1 } : { filter: "blur(0px)", opacity: 1 }}
			aria-hidden={true}
			className={cn("absolute inset-0 bg-muted", radius)}
			exit={reduce ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0 }}
			initial={reduce ? { opacity: 0 } : { filter: "blur(4px)", opacity: 0 }}
			layout="position"
			layoutId={layoutId}
		/>
	);
}

export function TabsContent({
	value,
	children,
	className,
}: {
	value: string;
	children: ReactNode;
	className?: string;
}) {
	const { value: current } = useTabs();
	const reduce = useReducedMotion();
	const active = current === value;
	// Inactive panels stay mounted but hidden, so their content (e.g. source
	// code) is present in the server-rendered HTML for crawlers and assistive
	// tech, instead of being dropped from the DOM.
	if (!active) {
		return (
			<div className={className} hidden>
				{children}
			</div>
		);
	}
	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className={cn("mt-4", className)}
			initial={{ opacity: 0, y: reduce ? 0 : 4 }}
			key={value}
			transition={{ duration: 0.18, ease: EASE_OUT }}
		>
			{children}
		</motion.div>
	);
}
