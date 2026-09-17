import { Select } from "@base-ui/react/select";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import {
	Check,
	ChevronDown,
	Layers,
	Plus,
	Settings,
} from "#/components/icons.tsx";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "#/lib/ease.ts";
import { SCOPE_VALUE } from "./scope.ts";
import type { NavItem } from "./UnderlineNav.tsx";
import { isNavDivider } from "./UnderlineNav.tsx";

export interface ProjectOption {
	id: string;
	name: string;
	slug: string;
}

interface AppSidebarProps {
	currentScope: string;
	isSettingsRoute?: boolean;
	items: readonly NavItem[];
	onScopeChange?: (value: string) => void;
	projects?: ProjectOption[];
}

export function AppSidebar({
	currentScope,
	isSettingsRoute = false,
	items,
	onScopeChange,
	projects = [],
}: AppSidebarProps) {
	const reduce = useReducedMotion();
	const activeId = useId();
	const selectedIcon = isSettingsRoute ? (
		<Settings className="size-4 shrink-0 text-muted-foreground" />
	) : (
		<Layers className="size-4 shrink-0 text-muted-foreground" />
	);

	const selectValue = isSettingsRoute
		? SCOPE_VALUE.settings
		: currentScope === "~"
			? SCOPE_VALUE.multi
			: currentScope;

	const selectItems = [
		{ label: "All projects", value: SCOPE_VALUE.multi },
		{ label: "Settings", value: SCOPE_VALUE.settings },
		{ label: "Create project", value: SCOPE_VALUE.create },
		...projects.map((p) => ({ label: p.name, value: p.slug })),
	];

	// Pseudo-values (multi/settings/create) are dispatched by AppShell's
	// single `handleScopeSelect` — this component only forwards.
	const itemClass =
		"grid cursor-default select-item-grid items-center gap-2 rounded-sm py-1.5 pr-2 pl-1 text-sm outline-hidden select-none data-highlighted:bg-muted data-highlighted:text-foreground";

	return (
		<aside className="sticky top-0 hidden h-screen w-70 shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground md:flex">
			{/* Project Selector */}
			<div className="shrink-0 p-3">
				<Select.Root
					items={selectItems}
					onValueChange={(value) => {
						if (value) {
							onScopeChange?.(value);
						}
					}}
					value={selectValue}
				>
					<Select.Trigger
						aria-label="Project selector"
						className="relative flex h-8 w-full select-none items-center rounded-md border border-sidebar-border bg-sidebar-accent py-1 pr-8 pl-8 text-sidebar-foreground text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-[popup-open]:border-ring"
						id="project-selector"
					>
						<span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
							{selectedIcon}
						</span>
						<Select.Value
							className="truncate text-left"
							placeholder="Select project"
						/>
						<span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">
							<ChevronDown className="size-4" />
						</span>
					</Select.Trigger>
					<Select.Portal>
						<Select.Positioner
							align="start"
							className="z-50 outline-hidden select-none"
							side="bottom"
							sideOffset={4}
						>
							<Select.Popup className="select-popup rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-hidden">
								{/* beUI select language: the panel unfolds out of the
								    trigger with a short blur rise (150–250ms). */}
								<motion.div
									animate={
										reduce
											? { opacity: 1 }
											: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 }
									}
									initial={
										reduce
											? { opacity: 0 }
											: { filter: "blur(4px)", opacity: 0, scale: 0.98, y: -4 }
									}
									transition={{ duration: 0.18, ease: EASE_OUT }}
								>
									<Select.List className="select-list overflow-y-auto outline-hidden scrollbar-thin">
										<Select.Item
											className={itemClass}
											value={SCOPE_VALUE.multi}
										>
											<Select.ItemIndicator className="col-start-1 flex items-center justify-center">
												<Check className="size-4.25" />
											</Select.ItemIndicator>
											<Select.ItemText className="col-start-2 flex min-w-0 items-center gap-2">
												<Layers className="size-4.25 shrink-0 text-muted-foreground" />
												<span className="min-w-0 flex-1 truncate">
													All projects
												</span>
											</Select.ItemText>
										</Select.Item>
										<div className="mt-1 border-popover border-t pt-1">
											<Select.Item
												className={itemClass}
												value={SCOPE_VALUE.settings}
											>
												<Select.ItemIndicator className="col-start-1 flex items-center justify-center">
													<Check className="size-4.25" />
												</Select.ItemIndicator>
												<Select.ItemText className="col-start-2 flex min-w-0 items-center gap-2">
													<Settings className="size-4.25 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate">
														Settings
													</span>
												</Select.ItemText>
											</Select.Item>
											<Select.Item
												className={itemClass}
												value={SCOPE_VALUE.create}
											>
												<Select.ItemIndicator className="col-start-1 flex items-center justify-center">
													<Check className="size-4.25" />
												</Select.ItemIndicator>
												<Select.ItemText className="col-start-2 flex min-w-0 items-center gap-2">
													<Plus className="size-4.25 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate">
														Create project
													</span>
												</Select.ItemText>
											</Select.Item>
										</div>
										<Select.Group className="mt-1 border-popover border-t pt-1">
											<Select.GroupLabel className="px-2 py-1 font-semibold text-micro text-muted-foreground uppercase tracking-wider">
												Projects
											</Select.GroupLabel>
											{projects.length > 0 ? (
												projects.map((p) => (
													<Select.Item
														className={itemClass}
														key={p.id}
														value={p.slug}
													>
														<Select.ItemIndicator className="col-start-1 flex items-center justify-center">
															<Check className="size-4.25" />
														</Select.ItemIndicator>
														<Select.ItemText className="col-start-2 min-w-0 truncate">
															{p.name}
														</Select.ItemText>
													</Select.Item>
												))
											) : (
												<div className="px-2 py-1.5 text-muted-foreground text-sm">
													No projects yet
												</div>
											)}
										</Select.Group>
									</Select.List>
								</motion.div>
							</Select.Popup>
						</Select.Positioner>
					</Select.Portal>
				</Select.Root>
			</div>

			{/* Navigation */}
			<nav
				aria-label="Primary"
				className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin"
			>
				{/* layoutRoot: the active indicator's layoutId measures in page
				    coordinates, so inside this scrolled container it would replay
				    scroll offsets as movement — scoping projection to the list
				    keeps the glide inside the nav (same pattern as motion/tabs). */}
				<motion.ul className="flex flex-col gap-0.5" layoutRoot>
					{items.map((item, index) => {
						if (isNavDivider(item)) {
							return (
								<li aria-hidden={true} key={item.id}>
									<hr className="my-1.5 border-sidebar-border" />
								</li>
							);
						}
						const isScoped = item.to.startsWith("/$projectSlug");
						return (
							<li key={item.to}>
								<motion.div
									animate={{ opacity: 1, x: 0 }}
									initial={{ opacity: 0, x: reduce ? 0 : -4 }}
									transition={{
										delay: reduce ? 0 : Math.min(index * 0.02, 0.12),
										duration: 0.18,
										ease: EASE_OUT,
									}}
									{...(reduce
										? {}
										: { whileTap: { scale: 0.98, transition: SPRING_PRESS } })}
								>
									<Link
										activeProps={{
											"aria-current": "page",
											className: "text-sidebar-accent-foreground font-medium",
										}}
										className="relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground text-sm outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
										to={item.to}
										{...(isScoped
											? { params: { projectSlug: currentScope } }
											: {})}
									>
										{({ isActive }) => (
											<>
												{/* beUI animated-sidebar language: one shared
												    surface glides between destinations on a
												    spring instead of snapping. Hover stays an
												    instant CSS wash — repeated actions feel
												    instant, spatial moves glide. */}
												{isActive ? (
													<motion.span
														aria-hidden={true}
														className="absolute inset-0 rounded-md bg-sidebar-accent"
														layout="position"
														layoutId={activeId}
														transition={
															reduce ? { duration: 0 } : SPRING_LAYOUT
														}
													/>
												) : null}
												{item.icon ? (
													<item.icon className="relative size-4.25 shrink-0" />
												) : null}
												<span className="relative">{item.label}</span>
											</>
										)}
									</Link>
								</motion.div>
							</li>
						);
					})}
				</motion.ul>
			</nav>
		</aside>
	);
}
