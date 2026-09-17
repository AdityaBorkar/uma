import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { useHoverCapable } from "#/lib/hooks/use-hover-capable.ts";

export interface NavLinkItem {
	icon?: React.ComponentType<{ className?: string }>;
	label: string;
	to: string;
}

export interface NavDividerItem {
	id: string;
	type: "divider";
}

export type NavItem = NavLinkItem | NavDividerItem;

export function isNavDivider(item: NavItem): item is NavDividerItem {
	return "type" in item && item.type === "divider";
}

// Settle without overshoot: a scrollable tab rail would turn even a small
// overshoot into a transient scrollbar and layout shift (same spring as
// motion/tabs.tsx).
const UNDERLINE_TRANSITION = {
	damping: 30,
	mass: 1.2,
	stiffness: 170,
	type: "spring",
} as const;

export function UnderlineNav({
	currentScope,
	items,
}: {
	currentScope?: string;
	items: readonly NavItem[];
}) {
	const underlineId = useId();
	const hoverUnderlineId = useId();
	const reduce = useReducedMotion();
	// Touch taps fire phantom `:hover` that sticks — only track the gliding
	// hover underline where a true hover exists.
	const canHover = useHoverCapable();
	const [hovered, setHovered] = useState<string | null>(null);
	return (
		<nav
			aria-label="Primary"
			className="sticky top-14 z-30 w-full border-b bg-background"
		>
			{/* layoutRoot scopes the underline's shared-layout projection to this
			    rail, so horizontal scrolling never replays as indicator drift. */}
			<motion.div
				className="mx-auto flex max-w-320 items-center gap-1 overflow-x-auto px-2 scrollbar-none sm:px-6"
				layoutRoot
				onMouseLeave={() => setHovered(null)}
			>
				{items.map((item) => {
					if (isNavDivider(item)) {
						return (
							<span
								aria-hidden={true}
								className="mx-1 h-5 w-px shrink-0 self-center bg-border"
								key={item.id}
							/>
						);
					}
					const isScoped = item.to.startsWith("/$projectSlug");
					return (
						<Link
							activeProps={{
								"aria-current": "page",
								className: "text-foreground font-semibold",
							}}
							className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
							key={item.to}
							onBlur={() => setHovered((cur) => (cur === item.to ? null : cur))}
							onFocus={() => setHovered(item.to)}
							onMouseEnter={() => setHovered(item.to)}
							onMouseLeave={() =>
								setHovered((cur) => (cur === item.to ? null : cur))
							}
							to={item.to}
							{...(isScoped && currentScope
								? { params: { projectSlug: currentScope } }
								: {})}
						>
							{({ isActive }) => (
								<>
									{item.icon ? <item.icon className="size-4.25" /> : null}
									{item.label}
									{/* beUI tabs underline language: one shared indicator
									    glides between tabs on a spring instead of
									    snapping per-tab borders on and off. */}
									{isActive ? (
										<motion.span
											aria-hidden={true}
											className="absolute inset-x-0 bottom-0 h-0.5 bg-underline"
											layout="position"
											layoutId={underlineId}
											transition={
												reduce ? { duration: 0 } : UNDERLINE_TRANSITION
											}
										/>
									) : null}
									{/* Hover language (beui.dev/components/motion/shared-layout-bg):
									    a muted underline glides between hovered tabs on
									    its own layoutId — opacity-only, so it stays
									    quiet next to the white active bar. */}
									<AnimatePresence>
										{canHover && !isActive && hovered === item.to ? (
											<motion.span
												animate={{ opacity: 1 }}
												aria-hidden={true}
												className="absolute inset-x-0 bottom-0 h-0.5 bg-border"
												exit={{ opacity: 0 }}
												initial={{ opacity: 0 }}
												key="nav-hover"
												layout="position"
												layoutId={hoverUnderlineId}
												transition={
													reduce ? { duration: 0 } : UNDERLINE_TRANSITION
												}
											/>
										) : null}
									</AnimatePresence>
								</>
							)}
						</Link>
					);
				})}
			</motion.div>
		</nav>
	);
}
