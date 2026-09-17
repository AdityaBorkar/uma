import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

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
	const reduce = useReducedMotion();
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
								</>
							)}
						</Link>
					);
				})}
			</motion.div>
		</nav>
	);
}
