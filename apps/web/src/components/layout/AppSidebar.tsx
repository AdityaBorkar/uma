import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { motion, useReducedMotion } from "motion/react";
import type {
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ArrowLeft, Layers } from "#/components/icons.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "#/components/motion/select.tsx";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "#/lib/ease.ts";
import {
	hydrateSidebarStore,
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MAX_WIDTH,
	SIDEBAR_MIN_WIDTH,
	setSidebarWidth,
	sidebarWidthStore,
} from "#/stores/sidebar.ts";
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
	const width = useSelector(sidebarWidthStore, (s) => s);
	const [resizing, setResizing] = useState(false);
	const dragState = useRef<{ startWidth: number; startX: number } | null>(null);

	useEffect(() => {
		hydrateSidebarStore();
	}, []);

	const handlePointerMove = useCallback((e: PointerEvent) => {
		const drag = dragState.current;
		if (!drag) return;
		setSidebarWidth(drag.startWidth + (e.clientX - drag.startX));
	}, []);

	const endDrag = useCallback(() => {
		dragState.current = null;
		setResizing(false);
		document.body.style.removeProperty("user-select");
		document.body.style.removeProperty("cursor");
		window.removeEventListener("pointermove", handlePointerMove);
		window.removeEventListener("pointerup", endDrag);
		window.removeEventListener("pointercancel", endDrag);
	}, [handlePointerMove]);

	useEffect(
		() => () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", endDrag);
			window.removeEventListener("pointercancel", endDrag);
		},
		[endDrag, handlePointerMove],
	);

	const beginDrag = useCallback(
		(e: ReactPointerEvent) => {
			if (e.button !== 0) return;
			e.preventDefault();
			dragState.current = {
				startWidth: sidebarWidthStore.state,
				startX: e.clientX,
			};
			setResizing(true);
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", endDrag);
			window.addEventListener("pointercancel", endDrag);
		},
		[endDrag, handlePointerMove],
	);

	const handleResizeKeyDown = useCallback((e: ReactKeyboardEvent) => {
		const step = e.shiftKey ? 24 : 8;
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			setSidebarWidth(sidebarWidthStore.state - step);
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			setSidebarWidth(sidebarWidthStore.state + step);
		} else if (e.key === "Home") {
			e.preventDefault();
			setSidebarWidth(SIDEBAR_MIN_WIDTH);
		} else if (e.key === "End") {
			e.preventDefault();
			setSidebarWidth(SIDEBAR_MAX_WIDTH);
		}
	}, []);
	const selectedIcon = (
		<Layers className="size-4 shrink-0 text-muted-foreground" />
	);

	const selectValue = currentScope === "~" ? SCOPE_VALUE.multi : currentScope;

	const selectedLabel =
		currentScope === "~"
			? "All projects"
			: (projects.find((p) => p.slug === currentScope)?.name ?? currentScope);

	// Pseudo-values (multi/settings/create) are dispatched by AppShell's
	// single `handleScopeSelect` — this component only forwards.

	return (
		<aside
			className="sticky top-0 hidden h-screen shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground md:flex"
			style={{ width }}
		>
			{/* Top slot: Back button on settings routes, otherwise the
			    project selector (beUI Select, gooey unfold variant). */}
			<div className="shrink-0 p-3">
				{isSettingsRoute ? (
					<Link
						aria-label="Back to workspace"
						className="flex h-8 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-sidebar-foreground text-sm outline-none hover:bg-sidebar-accent/70 focus-visible:ring-3 focus-visible:ring-ring/30"
						params={{ projectSlug: currentScope }}
						to="/$projectSlug/dashboard"
					>
						<ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate text-left">Back</span>
					</Link>
				) : (
					<Select
						onValueChange={(value) => {
							if (value) {
								onScopeChange?.(value);
							}
						}}
						value={selectValue}
					>
						<SelectTrigger className="h-8 border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-sidebar-foreground">
							<span className="flex min-w-0 flex-1 items-center gap-2">
								{selectedIcon}
								<span className="truncate text-left">{selectedLabel}</span>
							</span>
						</SelectTrigger>
						<SelectContent className="border-border bg-popover text-popover-foreground">
							<div className="max-h-80 overflow-y-auto scrollbar-thin">
								<ul>
									<SelectItem value={SCOPE_VALUE.multi}>
										<span className="flex min-w-0 flex-1 items-center gap-2">
											<Layers className="size-4 shrink-0 text-muted-foreground" />
											<span className="min-w-0 flex-1 truncate">
												All projects
											</span>
										</span>
									</SelectItem>
								</ul>
								{projects.length > 0 ? (
									<ul>
										{projects.map((p) => (
											<SelectItem key={p.id} value={p.slug}>
												<span className="min-w-0 flex-1 truncate">
													{p.name}
												</span>
											</SelectItem>
										))}
									</ul>
								) : (
									<div className="px-2.5 py-3 text-center text-muted-foreground text-sm">
										No projects yet
									</div>
								)}
							</div>
						</SelectContent>
					</Select>
				)}
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

			{/* Resizable right border: drag to resize, double-click to reset.
			    Width persists per device in `sidebarWidthStore` (localStorage). */}
			{/* biome-ignore lint/a11y/useSemanticElements: no native element is a focusable resize splitter; role="separator" with aria-valuenow is the WAI-ARIA splitter pattern. */}
			<div
				aria-label="Resize sidebar"
				aria-orientation="vertical"
				aria-valuemax={SIDEBAR_MAX_WIDTH}
				aria-valuemin={SIDEBAR_MIN_WIDTH}
				aria-valuenow={Math.round(width)}
				className="group absolute inset-y-0 -right-1.5 flex w-3 cursor-col-resize touch-none items-center justify-center outline-none"
				onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
				onKeyDown={handleResizeKeyDown}
				onPointerDown={beginDrag}
				role="separator"
				tabIndex={0}
				title="Drag to resize (double-click to reset)"
			>
				<span
					aria-hidden={true}
					className={
						resizing
							? "h-full w-0.5 bg-ring"
							: "h-full w-px bg-transparent transition-colors group-hover:bg-sidebar-border group-focus-visible:bg-ring"
					}
				/>
			</div>
		</aside>
	);
}
