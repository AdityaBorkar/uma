"use client";

// beui.dev/components/motion/select
//
// Vendored beUI Select (gooey unfold variant). Local adaptations to this
// theme, choreography untouched:
// - imports rewired to `#/lib/ease` + `#/lib/utils`
// - corner radius 12 -> RADIUS (6px, `--radius`) for rounded-md boxes
// - `hover:border-(--color-border-strong)` dropped (no such token here)
// - focus ring follows the repo pattern (ring-3 ring-ring/30)
// - panel shadow dropped (border-over-shadow rule); item radius -> rounded-sm

import {
	motion,
	type Transition,
	useReducedMotion,
	type Variants,
} from "motion/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Check, ChevronDown } from "#/components/icons.tsx";
import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

/** Corner radius for trigger + panel (rounded-md). */
const RADIUS = 6;

const INSTANT_TRANSITION: Transition = { duration: 0 };

// Spring with bounce powers the unfold/separation; per-property timings in the
// content choreograph it (see SelectContent). Mirrors bouncy-accordion's feel.
const CHEVRON_TRANSITION: Transition = {
	bounce: 0.3,
	duration: 0.4,
	type: "spring",
};

const LIST_VARIANTS: Variants = {
	hidden: {},
	show: { transition: { delayChildren: 0.05, staggerChildren: 0.035 } },
};
const ITEM_VARIANTS: Variants = {
	hidden: { filter: "blur(3px)", opacity: 0, y: -6 },
	show: { filter: "blur(0px)", opacity: 1, y: 0 },
};

type Placement = "bottom" | "top";

interface SelectContextValue {
	disabled: boolean;
	labelFor: (value: string | undefined) => string | undefined;
	listId: string;
	open: boolean;
	placement: Placement;
	reduce: boolean;
	register: (value: string, label: string) => void;
	select: (value: string) => void;
	setOpen: (open: boolean) => void;
	setPlacement: (p: Placement) => void;
	triggerId: string;
	unregister: (value: string) => void;
	value: string | undefined;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
	const ctx = useContext(SelectContext);
	if (!ctx) throw new Error(`${component} must be used within <Select>`);
	return ctx;
}

export interface SelectProps {
	children: ReactNode;
	className?: string;
	/** Uncontrolled initial open state. Default false. */
	defaultOpen?: boolean;
	defaultValue?: string;
	disabled?: boolean;
	/**
	 * Fires whenever the panel opens or closes. The panel is absolutely
	 * positioned inside the field, so a layout that stacks selects has to know
	 * which one is open to paint it above its neighbours.
	 */
	onOpenChange?: (open: boolean) => void;
	onValueChange?: (value: string) => void;
	/**
	 * Controlled open state of the panel. A layout that stacks selects can hold
	 * this to keep exactly one panel open — the panel is absolutely positioned
	 * inside its field, so two open at once paint over each other's options.
	 */
	open?: boolean;
	value?: string;
}

export function Select({
	value,
	defaultValue,
	onValueChange,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	disabled = false,
	className,
	children,
}: SelectProps) {
	const reduce = useReducedMotion() ?? false;
	const baseId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [internal, setInternal] = useState(defaultValue);
	const [labels, setLabels] = useState<Map<string, string>>(new Map());
	const [placement, setPlacement] = useState<Placement>("bottom");

	const controlled = value !== undefined;
	const current = controlled ? value : internal;
	const openControlled = openProp !== undefined;
	const open = openControlled ? openProp : internalOpen;

	const setOpen = useCallback(
		(next: boolean) => {
			if (!openControlled) setInternalOpen(next);
			onOpenChange?.(next);
		},
		[onOpenChange, openControlled],
	);

	const select = useCallback(
		(next: string) => {
			if (!controlled) setInternal(next);
			onValueChange?.(next);
			setOpen(false);
		},
		[controlled, onValueChange, setOpen],
	);

	const register = useCallback((v: string, label: string) => {
		setLabels((m) => (m.get(v) === label ? m : new Map(m).set(v, label)));
	}, []);
	const unregister = useCallback((v: string) => {
		setLabels((m) => {
			if (!m.has(v)) return m;
			const next = new Map(m);
			next.delete(v);
			return next;
		});
	}, []);

	// close on outside pointer / escape
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		const onPointer = (e: PointerEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node))
				setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointer);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointer);
		};
	}, [open, setOpen]);

	const ctx = useMemo<SelectContextValue>(
		() => ({
			disabled,
			labelFor: (v) => (v === undefined ? undefined : labels.get(v)),
			listId: `${baseId}-list`,
			open,
			placement,
			reduce,
			register,
			select,
			setOpen,
			setPlacement,
			triggerId: `${baseId}-trigger`,
			unregister,
			value: current,
		}),
		[
			current,
			open,
			setOpen,
			select,
			register,
			unregister,
			labels,
			reduce,
			baseId,
			disabled,
			placement,
		],
	);

	return (
		<SelectContext.Provider value={ctx}>
			<div className={cn("relative", className)} ref={rootRef}>
				{children}
			</div>
		</SelectContext.Provider>
	);
}

export interface SelectTriggerProps {
	children: ReactNode;
	className?: string;
}

export function SelectTrigger({ className, children }: SelectTriggerProps) {
	const ctx = useSelectContext("SelectTrigger");
	const isTop = ctx.placement === "top";
	// edge facing the panel flattens then rounds; the far edge stays rounded.
	// All four corners are specified so none gets stranded when placement flips.
	const kf = ctx.open ? [0, 0, RADIUS] : [RADIUS, 0, RADIUS];
	const kfT: Transition = ctx.reduce
		? { duration: 0 }
		: ctx.open
			? { duration: 0.6, ease: EASE_OUT, times: [0, 0.4, 1] }
			: { duration: 0.42, ease: EASE_OUT, times: [0, 0.5, 1] };
	return (
		<motion.button
			animate={{
				borderBottomLeftRadius: isTop ? RADIUS : kf,
				borderBottomRightRadius: isTop ? RADIUS : kf,
				borderTopLeftRadius: isTop ? kf : RADIUS,
				borderTopRightRadius: isTop ? kf : RADIUS,
			}}
			aria-controls={ctx.listId}
			aria-expanded={ctx.open}
			aria-haspopup="listbox"
			className={cn(
				"relative z-10 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm outline-none transition-colors",
				"focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
				"disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			disabled={ctx.disabled}
			id={ctx.triggerId}
			// Gooey: the edge facing the panel snaps flat (panel attached) then rounds
			// back once the panel pulls away — the two pinch apart.
			initial={false}
			onClick={() => ctx.setOpen(!ctx.open)}
			transition={{
				borderBottomLeftRadius: isTop ? INSTANT_TRANSITION : kfT,
				borderBottomRightRadius: isTop ? INSTANT_TRANSITION : kfT,
				borderTopLeftRadius: isTop ? kfT : INSTANT_TRANSITION,
				borderTopRightRadius: isTop ? kfT : INSTANT_TRANSITION,
			}}
			type="button"
		>
			{children}
			<motion.span
				animate={{ rotate: ctx.open ? 180 : 0 }}
				aria-hidden
				className="shrink-0 text-muted-foreground"
				transition={ctx.reduce ? { duration: 0 } : CHEVRON_TRANSITION}
			>
				<ChevronDown className="h-4 w-4" />
			</motion.span>
		</motion.button>
	);
}

export interface SelectValueProps {
	className?: string;
	placeholder?: string;
}

export function SelectValue({ placeholder, className }: SelectValueProps) {
	const ctx = useSelectContext("SelectValue");
	const label = ctx.labelFor(ctx.value);
	return (
		<span
			className={cn(
				label ? "text-foreground" : "text-muted-foreground",
				className,
			)}
		>
			{label ?? placeholder ?? "Select"}
		</span>
	);
}

export interface SelectContentProps {
	children: ReactNode;
	className?: string;
}

export function SelectContent({ className, children }: SelectContentProps) {
	const ctx = useSelectContext("SelectContent");
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);
	const open = ctx.open;
	const { setPlacement } = ctx;

	useLayoutEffect(() => {
		const node = innerRef.current;
		if (!node) return;
		const measure = () => setHeight(node.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	});

	// On open, flip upward when there isn't room below and there's more above.
	useLayoutEffect(() => {
		if (!open) return;
		const trigger = document.getElementById(ctx.triggerId);
		const node = innerRef.current;
		if (!trigger || !node) return;
		const rect = trigger.getBoundingClientRect();
		const h = node.offsetHeight;
		const below = window.innerHeight - rect.bottom;
		const above = rect.top;
		setPlacement(below < h + 16 && above > below ? "top" : "bottom");
	}, [open, ctx.triggerId, setPlacement]);

	// Specify EVERY corner + both margins each render. The near edge (facing the
	// trigger) animates flat->round and the gap opens on that side; the far edge
	// stays rounded and its margin pinned to 0. Setting all of them avoids a
	// stranded square corner when the placement flips between opens.
	const isTop = ctx.placement === "top";
	const nearGap = open ? 8 : 0;
	const nearRadius = open ? RADIUS : 0;

	const gapT: Transition = open
		? { bounce: 0.5, delay: 0.12, duration: 0.6, type: "spring" }
		: { bounce: 0.1, duration: 0.3, type: "spring" };
	const radiusT: Transition = open
		? { delay: 0.14, duration: 0.3, ease: EASE_OUT }
		: { duration: 0.16, ease: EASE_OUT };

	// Items stay mounted (open just animates the panel) so each item's label
	// registration persists — otherwise the trigger would fall back to the
	// placeholder the moment the panel closes.
	return (
		<motion.div
			animate={
				ctx.reduce
					? { height: open ? height : 0, opacity: open ? 1 : 0 }
					: {
							borderBottomLeftRadius: isTop ? nearRadius : RADIUS,
							borderBottomRightRadius: isTop ? nearRadius : RADIUS,
							// near corners go flat->round; far corners stay rounded
							borderTopLeftRadius: isTop ? RADIUS : nearRadius,
							borderTopRightRadius: isTop ? RADIUS : nearRadius,
							height: open ? height : 0,
							marginBottom: isTop ? nearGap : 0,
							// gap opens on the side facing the trigger
							marginTop: isTop ? 0 : nearGap,
							opacity: open ? 1 : 0,
						}
			}
			aria-hidden={!open}
			aria-labelledby={ctx.triggerId}
			// flush against the trigger, then separates into its own rounded pill;
			// sits above or below depending on available space
			className={cn(
				"absolute right-0 left-0 z-20 rounded-md border border-border bg-background",
				isTop ? "bottom-full" : "top-full",
				className,
			)}
			id={ctx.listId}
			inert={!open}
			initial={false}
			role="listbox"
			style={{
				overflow: "hidden",
				pointerEvents: open ? "auto" : "none",
				transformOrigin: isTop ? "bottom" : "top",
			}}
			transition={
				ctx.reduce
					? { duration: 0.12 }
					: {
							borderBottomLeftRadius: isTop ? radiusT : INSTANT_TRANSITION,
							borderBottomRightRadius: isTop ? radiusT : INSTANT_TRANSITION,
							borderTopLeftRadius: isTop ? INSTANT_TRANSITION : radiusT,
							borderTopRightRadius: isTop ? INSTANT_TRANSITION : radiusT,
							height: open
								? { bounce: 0.14, duration: 0.42, type: "spring" }
								: { delay: 0.14, duration: 0.26, ease: EASE_OUT },
							marginBottom: isTop ? gapT : INSTANT_TRANSITION,
							marginTop: isTop ? INSTANT_TRANSITION : gapT,
							opacity: open
								? { duration: 0.18 }
								: { delay: 0.12, duration: 0.16 },
						}
			}
		>
			<motion.div
				ref={innerRef}
				// exactOptionalPropertyTypes: absent prop instead of `variants={undefined}`.
				{...(ctx.reduce ? {} : { variants: LIST_VARIANTS })}
				animate={open ? "show" : "hidden"}
				className="p-1"
				initial={false}
			>
				{children}
			</motion.div>
		</motion.div>
	);
}

export interface SelectItemProps {
	children: ReactNode;
	className?: string;
	disabled?: boolean;
	value: string;
}

export function SelectItem({
	value,
	disabled = false,
	className,
	children,
}: SelectItemProps) {
	const ctx = useSelectContext("SelectItem");
	const selected = ctx.value === value;
	const label = typeof children === "string" ? children : value;

	useLayoutEffect(() => {
		ctx.register(value, label);
		return () => ctx.unregister(value);
	}, [ctx.register, ctx.unregister, value, label]);

	return (
		// exactOptionalPropertyTypes: absent prop instead of `variants={undefined}`.
		<motion.li {...(ctx.reduce ? {} : { variants: ITEM_VARIANTS })}>
			<button
				aria-selected={selected}
				className={cn(
					"flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
					selected
						? "bg-muted text-foreground"
						: "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted",
					"disabled:pointer-events-none disabled:opacity-50",
					className,
				)}
				disabled={disabled}
				onClick={() => ctx.select(value)}
				role="option"
				type="button"
			>
				{children}
				{selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
			</button>
		</motion.li>
	);
}
