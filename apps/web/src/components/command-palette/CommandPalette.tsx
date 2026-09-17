import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";

import { Search } from "#/components/icons.tsx";
import { Dialog, DialogContent } from "#/components/ui/dialog.tsx";
import { cn } from "#/lib/utils.ts";
import {
	closeCommandPalette,
	commandPaletteOpenStore,
	requestCreate,
	setCommandPaletteOpen,
	toggleCommandPalette,
} from "#/stores/command-palette.ts";
import {
	buildCommands,
	COMMAND_GROUP_LABELS,
	COMMAND_GROUP_ORDER,
	type CommandAction,
	type CommandContext,
	type CommandGroupId,
	filterCommands,
	isCommandPaletteShortcut,
	type ProjectRef,
} from "./commands.ts";

interface CommandPaletteProps {
	currentScope: string;
	onScopeChange: (value: string) => void;
	projects: ProjectRef[];
}

/**
 * Global command palette (`Cmd+K` / `Ctrl+K`, also `Ctrl+/`). Rendered once
 * by `AppShell` so it sees the current scope and project list. The command
 * list itself lives in `commands.ts` — this component only renders, filters,
 * and runs it. Creation commands set a one-shot intent in
 * `createIntentStore` (navigating to the owning page first when needed);
 * the owning surface opens its dialog.
 */
export function CommandPalette({
	currentScope,
	onScopeChange,
	projects,
}: CommandPaletteProps) {
	const open = useSelector(commandPaletteOpenStore, (s) => s);
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isCommandPaletteShortcut(event)) {
				event.preventDefault();
				toggleCommandPalette();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		setQuery("");
		setActiveIndex(0);
		const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
		return () => window.clearTimeout(timer);
	}, [open]);

	const commands = useMemo(
		() => buildCommands({ currentScope, projects }),
		[currentScope, projects],
	);

	const ctx: CommandContext = useMemo(
		() => ({
			navigate: (href) => {
				void navigate({ href });
			},
			requestCreateDocument: () => {
				requestCreate("document");
				if (!window.location.pathname.endsWith("/documents")) {
					void navigate({ href: `/${currentScope}/documents` });
				}
			},
			requestCreateProject: () => {
				requestCreate("project");
			},
			requestCreateTask: () => {
				requestCreate("task");
				if (!window.location.pathname.endsWith("/tasks")) {
					void navigate({ href: `/${currentScope}/tasks` });
				}
			},
			scope: currentScope,
			switchScope: (slug) => {
				onScopeChange(slug);
			},
		}),
		[currentScope, navigate, onScopeChange],
	);

	const filtered = useMemo(
		() => filterCommands(commands, query),
		[commands, query],
	);
	const active =
		filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

	const grouped = useMemo(() => {
		const out: Array<{
			id: CommandGroupId;
			items: CommandAction[];
			label: string;
		}> = [];
		for (const id of COMMAND_GROUP_ORDER) {
			const items = filtered.filter((c) => c.group === id);
			if (items.length > 0) {
				out.push({ id, items, label: COMMAND_GROUP_LABELS[id] });
			}
		}
		return out;
	}, [filtered]);

	useEffect(() => {
		itemRefs.current[active]?.scrollIntoView({ block: "nearest" });
	}, [active]);

	function runAction(action: CommandAction) {
		closeCommandPalette();
		action.run(ctx);
	}

	function onInputKeyDown(event: React.KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((i) =>
				filtered.length === 0 ? 0 : (i + 1) % filtered.length,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((i) =>
				filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
			);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const action = filtered[active];
			if (action) {
				runAction(action);
			}
		}
	}

	let flatIndex = -1;

	return (
		<Dialog onOpenChange={setCommandPaletteOpen} open={open}>
			<DialogContent
				className="overflow-hidden p-0"
				onClose={closeCommandPalette}
			>
				<div className="flex items-center gap-2.5 border-b bg-muted/50 px-4">
					<Search className="size-4 shrink-0 text-muted-foreground" />
					<input
						aria-activedescendant={
							filtered[active]
								? `command-option-${filtered[active].id}`
								: undefined
						}
						aria-controls="command-palette-listbox"
						aria-expanded={true}
						autoComplete="off"
						className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={onInputKeyDown}
						placeholder="Type a command or search…"
						ref={inputRef}
						role="combobox"
						spellCheck={false}
						type="text"
						value={query}
					/>
					<kbd className="shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-micro text-muted-foreground">
						esc
					</kbd>
				</div>
				<div
					className="max-h-80 overflow-y-auto p-2 scrollbar-thin"
					id="command-palette-listbox"
					role="listbox"
				>
					{filtered.length === 0 ? (
						<p className="px-4 py-8 text-center text-muted-foreground text-sm">
							No commands found.
						</p>
					) : (
						grouped.map((group) => (
							<div key={group.id}>
								<div className="px-2.5 pt-3 pb-1 font-semibold text-micro text-muted-foreground uppercase tracking-widest">
									{group.label}
								</div>
								<ul>
									{group.items.map((action) => {
										flatIndex += 1;
										const index = flatIndex;
										const isActive = index === active;
										return (
											<li key={action.id}>
												<button
													aria-selected={isActive}
													className={cn(
														"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none",
														isActive
															? "bg-muted text-foreground"
															: "text-muted-foreground hover:text-foreground",
													)}
													id={`command-option-${action.id}`}
													onClick={() => runAction(action)}
													onMouseEnter={() => setActiveIndex(index)}
													ref={(el) => {
														itemRefs.current[index] = el;
													}}
													role="option"
													type="button"
												>
													<action.icon className="size-4 shrink-0" />
													<span className="min-w-0 flex-1">
														<span className="block truncate font-medium">
															{action.title}
														</span>
														{action.description ? (
															<span className="block truncate text-muted-foreground text-xs">
																{action.description}
															</span>
														) : null}
													</span>
													{isActive ? (
														<span
															aria-hidden={true}
															className="shrink-0 text-micro text-muted-foreground"
														>
															↵
														</span>
													) : null}
												</button>
											</li>
										);
									})}
								</ul>
							</div>
						))
					)}
				</div>
				<div className="flex items-center gap-3 border-t bg-muted/50 px-4 py-2 text-micro text-muted-foreground">
					<span>
						<kbd className="rounded border bg-background px-1 font-mono">
							↑↓
						</kbd>{" "}
						to navigate
					</span>
					<span>
						<kbd className="rounded border bg-background px-1 font-mono">↵</kbd>{" "}
						to select
					</span>
					<span className="ml-auto hidden sm:inline">⌘K or Ctrl+/</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}
