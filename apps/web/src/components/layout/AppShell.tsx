import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import { ChevronDown, Layers, Settings2 } from "#/components/icons.tsx";
import { useProjects } from "#/components/lists/shared.tsx";
import { ProjectForm } from "#/components/projects/ProjectForm.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { useOptionalWorkspace } from "#/components/workspace.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";
import { AppSidebar } from "./AppSidebar.tsx";
import { SCOPE_VALUE } from "./scope.ts";
import { type NavItem, UnderlineNav } from "./UnderlineNav.tsx";

interface AppShellProps {
	children: ReactNode;
	isSettings?: boolean;
	items: readonly NavItem[];
	/** Raw slug from the URL while the workspace value is still loading. */
	scopeOverride?: string;
}

function CreateProjectDialog({
	onCreated,
	onOpenChange,
	open,
}: {
	onCreated: (slug: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	const createMut = useMutation(
		rpc.projects.create.mutationOptions({
			onError: (error: unknown) => {
				const message =
					error instanceof Error ? error.message : "Failed to create project";
				toast({ description: message, title: "Error", variant: "destructive" });
			},
			onSuccess: (data) => {
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.projects.list.key()),
				});
				toast({ description: data.name, title: "Project created" });
				onOpenChange(false);
				onCreated(data.slug);
			},
		}),
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="p-0" onClose={() => onOpenChange(false)}>
				<DialogHeader className="px-4 py-3">
					<DialogTitle>Create project</DialogTitle>
					<DialogDescription>
						Organize your work into projects.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] overflow-y-auto px-4 py-4">
					<ProjectForm
						loading={createMut.isPending}
						onCancel={() => onOpenChange(false)}
						onSubmit={async (values) => {
							await createMut.mutateAsync({
								description: values.description,
								name: values.name,
								status: values.status,
							});
						}}
						submitLabel="Create project"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function AppShell({
	children,
	isSettings = false,
	items,
	scopeOverride,
}: AppShellProps) {
	const navigate = useNavigate();
	const [createOpen, setCreateOpen] = useState(false);

	const { projects } = useProjects();

	// Scope is owned by WorkspaceProvider when present; settings shell and
	// loading states fall back to the URL slug, then last-visited, then multi.
	const workspace = useOptionalWorkspace();
	const routerPathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const [storedScope, setStoredScope] = useState<string | null>(null);

	useEffect(() => {
		try {
			const last = localStorage.getItem("planner:lastScope");
			// react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- hydration fix: render SSR-safe "~" first, then sync browser-only stored scope post-mount; extra render is intentional per no-hydration-branch rule
			if (last) {
				setStoredScope(last);
			}
		} catch {
			// ignore
		}
	}, []);

	const currentScope =
		workspace?.projectSlug ?? scopeOverride ?? storedScope ?? "~";

	const isMulti = currentScope === "~";
	const selectedLabel = (() => {
		if (isSettings) {
			return "Settings";
		}
		if (isMulti) {
			return "All projects";
		}
		const found = projects.find((p) => p.slug === currentScope);
		return found?.name ?? currentScope;
	})();
	const scopeHint =
		selectedLabel === "All projects" ? "All projects together" : selectedLabel;

	/** Preserve the current tab when switching projects (`/old/rest` → `/new/rest`). */
	function handleScopeChange(nextSlug: string) {
		const seg = routerPathname.split("/").filter(Boolean);
		if (seg.length >= 2 && seg[0] !== "settings") {
			const rest = seg.slice(1).join("/");
			void navigate({ href: `/${nextSlug}/${rest}` });
			return;
		}
		void navigate({
			params: { projectSlug: nextSlug },
			to: "/$projectSlug/dashboard",
		});
	}

	function handleScopeSelect(value: string) {
		if (value === SCOPE_VALUE.create) {
			setCreateOpen(true);
			return;
		}
		if (value === SCOPE_VALUE.multi) {
			handleScopeChange("~");
			return;
		}
		if (value === SCOPE_VALUE.settings) {
			void navigate({ to: "/settings" });
			return;
		}
		handleScopeChange(value);
	}

	return (
		<div className="flex min-h-screen bg-background">
			<AppSidebar
				currentScope={currentScope}
				isSettingsRoute={isSettings}
				items={items}
				onScopeChange={handleScopeSelect}
				projects={projects}
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				{/* Mobile: keep top header + horizontal nav when sidebar is hidden */}
				<div className="md:hidden">
					{/* Mobile Project Selector */}
					<div className="border-b bg-muted/50 px-4 py-2">
						<label
							className="mb-1 block font-medium text-[11px] text-muted-foreground uppercase tracking-widest"
							htmlFor="project-selector-mobile"
						>
							Project
						</label>
						<div className="relative">
							<div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
								{isSettings ? (
									<Settings2 className="size-4 text-muted-foreground" />
								) : (
									<Layers className="size-4 text-muted-foreground" />
								)}
							</div>
							<select
								aria-label="Project selector"
								className="flex h-8 w-full appearance-none rounded-md border border-input bg-background py-1 pr-8 pl-8 text-sm shadow-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
								id="project-selector-mobile"
								onChange={(e) => handleScopeSelect(e.target.value)}
								value={
									isSettings
										? SCOPE_VALUE.settings
										: isMulti
											? SCOPE_VALUE.multi
											: currentScope
								}
							>
								<option value={SCOPE_VALUE.multi}>All projects</option>
								{projects.length > 0 ? (
									<optgroup label="Projects">
										{projects.map((p) => (
											<option key={p.id} value={p.slug}>
												{p.name}
											</option>
										))}
									</optgroup>
								) : null}
								<option value={SCOPE_VALUE.settings}>Settings</option>
								<option value={SCOPE_VALUE.create}>Create project</option>
							</select>
							<div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">
								<ChevronDown className="size-4" />
							</div>
						</div>
						<p className="mt-1 truncate text-[11px] text-muted-foreground">
							{scopeHint}
						</p>
					</div>
					<UnderlineNav currentScope={currentScope} items={items} />
				</div>
				<main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
					{children}
				</main>
			</div>
			<CreateProjectDialog
				onCreated={(slug) => handleScopeChange(slug)}
				onOpenChange={setCreateOpen}
				open={createOpen}
			/>
		</div>
	);
}
