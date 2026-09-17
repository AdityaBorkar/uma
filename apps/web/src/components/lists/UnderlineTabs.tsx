import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { useHoverCapable } from "#/lib/hooks/use-hover-capable.ts";
import { cn } from "#/lib/utils.ts";

export interface UnderlineTab {
	label: string;
	value: string | undefined;
}

// Settle without overshoot: the rail scrolls, so even a small overshoot
// would flash a transient scrollbar (same spring as motion/tabs.tsx and
// layout/UnderlineNav.tsx).
const UNDERLINE_TRANSITION = {
	damping: 30,
	mass: 1.2,
	stiffness: 170,
	type: "spring",
} as const;

/**
 * Button-based underline tabs sharing UnderlineNav's active styling.
 * The active underline glides on a shared layoutId (beUI tabs language);
 * a muted hover underline glides on its own layoutId
 * (beui.dev/components/motion/shared-layout-bg).
 */
export function UnderlineTabs({
	activeValue,
	onSelect,
	tabs,
}: {
	activeValue: string | undefined;
	onSelect: (value: string | undefined) => void;
	tabs: UnderlineTab[];
}) {
	const underlineId = useId();
	const hoverUnderlineId = useId();
	const reduce = useReducedMotion();
	// Touch taps fire phantom `:hover` that sticks — only track the gliding
	// hover underline where a true hover exists.
	const canHover = useHoverCapable();
	const [hovered, setHovered] = useState<string | null>(null);
	return (
		<motion.nav
			className="flex items-center gap-1 overflow-x-auto border-b scrollbar-none"
			layoutRoot
			onMouseLeave={() => setHovered(null)}
		>
			{tabs.map((t) => {
				const key = t.value ?? "__all";
				const active =
					t.value === undefined
						? activeValue === undefined
						: activeValue === t.value;
				return (
					<button
						aria-pressed={active}
						className={cn(
							"relative -mb-px shrink-0 whitespace-nowrap px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
							active
								? "font-semibold text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						key={key}
						onBlur={() => setHovered((cur) => (cur === key ? null : cur))}
						onClick={() => onSelect(t.value)}
						onFocus={() => setHovered(key)}
						onMouseEnter={() => setHovered(key)}
						onMouseLeave={() => setHovered((cur) => (cur === key ? null : cur))}
						type="button"
					>
						{t.label}
						{active ? (
							<motion.span
								aria-hidden={true}
								className="absolute inset-x-0 -bottom-px h-0.5 bg-underline"
								layout="position"
								layoutId={underlineId}
								transition={reduce ? { duration: 0 } : UNDERLINE_TRANSITION}
							/>
						) : null}
						<AnimatePresence>
							{canHover && !active && hovered === key ? (
								<motion.span
									animate={{ opacity: 1 }}
									aria-hidden={true}
									className="absolute inset-x-0 -bottom-px h-0.5 bg-border"
									exit={{ opacity: 0 }}
									initial={{ opacity: 0 }}
									key="tab-hover"
									layout="position"
									layoutId={hoverUnderlineId}
									transition={reduce ? { duration: 0 } : UNDERLINE_TRANSITION}
								/>
							) : null}
						</AnimatePresence>
					</button>
				);
			})}
		</motion.nav>
	);
}
