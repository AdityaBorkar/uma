import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

import {
	BookOpen,
	LayoutDashboard,
	Radar,
	Radio,
	SquareKanban,
} from "#/components/icons.tsx";
import { AppShell } from "#/components/layout/AppShell.tsx";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import {
	WorkspaceProvider,
	type WorkspaceValue,
} from "#/components/workspace.tsx";
import { rpc } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/$projectSlug")({
	component: WorkspaceLayout,
});

const navItems = [
	{ icon: LayoutDashboard, label: "Dashboard", to: "/$projectSlug/dashboard" },
	{ icon: BookOpen, label: "Documents", to: "/$projectSlug/documents" },
	{ icon: Radar, label: "Monitor", to: "/$projectSlug/monitor" },
	{ icon: Radio, label: "Signals", to: "/$projectSlug/signals" },
	{ icon: SquareKanban, label: "Tasks", to: "/$projectSlug/tasks" },
] as const;

const MULTI_WORKSPACE: WorkspaceValue = {
	isMulti: true,
	project: null,
	projectId: null,
	projectSlug: "~",
};

function WorkspaceLayout() {
	const { projectSlug } = Route.useParams();
	const isMulti = projectSlug === "~";

	const projectQuery = useQuery(
		rpc.projects.getBySlug.queryOptions({
			enabled: !isMulti,
			input: { slug: projectSlug },
		}),
	);

	useEffect(() => {
		try {
			localStorage.setItem("planner:lastScope", projectSlug);
		} catch {
			// ignore — private mode / storage disabled
		}
	}, [projectSlug]);

	const project = isMulti ? null : projectQuery.data;
	const workspace: WorkspaceValue = project
		? {
				isMulti: false,
				project: { id: project.id, name: project.name, slug: project.slug },
				projectId: project.id,
				projectSlug: project.slug,
			}
		: MULTI_WORKSPACE;

	let body: ReactNode = <Outlet />;
	if (!isMulti && projectQuery.isPending) {
		body = (
			<div className="mx-auto w-full max-w-[1280px] px-4 py-8">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="mt-6 h-64 w-full" />
			</div>
		);
	} else if (!isMulti && projectQuery.isError) {
		const msg =
			projectQuery.error instanceof Error
				? projectQuery.error.message
				: "Failed to load project";
		const notFound = msg.toLowerCase().includes("not found");
		const description = notFound
			? `No project with slug "${projectSlug}" for your account.`
			: msg;
		body = (
			<div className="mx-auto w-full max-w-[1280px] px-4 py-10">
				<Alert variant={notFound ? "default" : "destructive"}>
					<AlertTitle>{notFound ? "Project not found" : "Error"}</AlertTitle>
					<AlertDescription className="flex flex-col gap-3">
						<span>{description}</span>
						<span className="flex gap-2">
							<Button asChild={true} size="sm" variant="outline">
								<Link to="/settings/projects">Browse projects</Link>
							</Button>
							<Button asChild={true} size="sm" variant="outline">
								<Link
									params={{ projectSlug: "~" }}
									to="/$projectSlug/dashboard"
								>
									Go to All projects
								</Link>
							</Button>
						</span>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<WorkspaceProvider value={workspace}>
			<AppShell
				items={navItems}
				scopeOverride={!isMulti && !project ? projectSlug : undefined}
			>
				{body}
			</AppShell>
		</WorkspaceProvider>
	);
}
