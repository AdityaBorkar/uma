import { Select } from "@base-ui/react/select";
import { Link } from "@tanstack/react-router";

import {
	Check,
	ChevronDown,
	Layers,
	Plus,
	Settings,
} from "#/components/icons.tsx";
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
		"grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-[4px] py-1.5 pr-2 pl-1 text-sm outline-hidden select-none data-highlighted:bg-muted data-highlighted:text-foreground";

	return (
		<aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground md:flex">
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
						className="relative flex h-8 w-full select-none items-center rounded-md border border-sidebar-border bg-sidebar-accent py-1 pr-8 pl-8 text-sidebar-foreground text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[popup-open]:border-ring"
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
							<Select.Popup className="min-w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] rounded-md border border-popover bg-popover p-1 text-popover-foreground outline-hidden">
								<Select.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto outline-hidden [scrollbar-width:thin]">
									<Select.Item className={itemClass} value={SCOPE_VALUE.multi}>
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
										<Select.GroupLabel className="px-2 py-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
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
							</Select.Popup>
						</Select.Positioner>
					</Select.Portal>
				</Select.Root>
			</div>

			{/* Navigation */}
			<nav
				aria-label="Primary"
				className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]"
			>
				<ul className="flex flex-col gap-0.5">
					{items.map((item) => {
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
								<Link
									activeProps={{
										className:
											"bg-sidebar-accent text-sidebar-accent-foreground font-medium",
									}}
									className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-muted-foreground text-sm hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
									to={item.to}
									{...(isScoped
										? { params: { projectSlug: currentScope } }
										: {})}
								>
									{item.icon ? (
										<item.icon className="size-4.25 shrink-0" />
									) : null}
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</aside>
	);
}
