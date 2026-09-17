import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { type ReactNode, useEffect, useState } from "react";

import { FormDialog } from "#/components/forms/FormDialog.tsx";
import { ChevronDown, Layers, Settings2 } from "#/components/icons.tsx";
import { useProjects } from "#/components/lists/shared.tsx";
import { ProjectForm } from "#/components/projects/ProjectForm.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { useOptionalWorkspace } from "#/components/workspace.tsx";
import { rpc } from "#/lib/rpc.ts";
import { invalidateProjects } from "#/stores/invalidation.ts";
import { hydrateScopeStore, lastScopeStore } from "#/stores/scope.ts";
import { hydrateSidebarStore } from "#/stores/sidebar.ts";
import { AppSidebar } from "./AppSidebar.tsx";
import { SCOPE_VALUE } from "./scope.ts";
import { type NavItem, UnderlineNav } from "./UnderlineNav.tsx";

interface AppShellProps {
	children: ReactNode;
	isSettings?: boolean | undefined;
	items: readonly NavItem[];
	/** Raw slug from the URL while the workspace value is still loading. */
	scopeOverride?: string | undefined;
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
				invalidateProjects(queryClient);
				toast({ description: data.name, title: "Project created" });
				onOpenChange(false);
				onCreated(data.slug);
			},
		}),
	);

	return (
		<FormDialog
			description="Organize your work into projects."
			onClose={() => onOpenChange(false)}
			onOpenChange={onOpenChange}
			open={open}
			title="Create project"
		>
			<ProjectForm
				loading={createMut.isPending}
				onCancel={() => onOpenChange(false)}
				onSubmit={async (values) => {
					await createMut.mutateAsync({
						githubRepoFullName: values.githubRepoFullName,
						name: values.name,
					});
				}}
				submitLabel="Create project"
			/>
		</FormDialog>
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
	// Last-visited lives in `lastScopeStore` (persisted + cross-tab synced).
	const workspace = useOptionalWorkspace();
	const routerPathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const storedScope = useSelector(lastScopeStore, (s) => s);

	useEffect(() => {
		hydrateScopeStore();
		hydrateSidebarStore();
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
			<a className="skip-link" href="#main-content">
				Skip to content
			</a>
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
							className="mb-1 block font-medium text-micro text-muted-foreground uppercase tracking-widest"
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
								className="flex h-8 w-full appearance-none rounded-md border border-input bg-background py-1 pr-8 pl-8 text-sm shadow-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
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
						<p className="mt-1 truncate text-micro text-muted-foreground">
							{scopeHint}
						</p>
					</div>
					<UnderlineNav currentScope={currentScope} items={items} />
				</div>
				<main
					className="mx-auto w-full max-w-320 flex-1 px-4 py-6 sm:px-6"
					id="main-content"
					tabIndex={-1}
				>
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
