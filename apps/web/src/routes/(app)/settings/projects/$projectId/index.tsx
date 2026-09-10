import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useState } from "react";

import { ProjectForm } from "#/components/projects/ProjectForm.tsx";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/settings/projects/$projectId/")({
	component: ProjectDetailPage,
});

function ProjectDetailPage() {
	const { projectId } = Route.useParams();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const [editing, setEditing] = useState(false);

	const projectQuery = useQuery(
		rpc.projects.get.queryOptions({
			input: { id: projectId },
		}),
	);

	const updateMut = useMutation(
		rpc.projects.update.mutationOptions({
			onError: (error: unknown) => {
				toast({
					description: error instanceof Error ? error.message : "Unknown error",
					title: "Update failed",
					variant: "destructive",
				});
			},
			onSuccess: (data) => {
				void queryClient.invalidateQueries({
					queryKey: rpc.projects.get.key({ input: { id: projectId } }),
				});
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.projects.list.key()),
				});
				toast({ description: data.name, title: "Project updated" });
				posthog.capture("project_updated", { projectId });
				setEditing(false);
			},
		}),
	);

	if (projectQuery.isPending) {
		return <Skeleton className="h-64 w-full" />;
	}
	if (projectQuery.isError) {
		const msg =
			projectQuery.error instanceof Error
				? projectQuery.error.message
				: "Failed to load";
		const isNotFound = msg.toLowerCase().includes("not found");
		return (
			<Alert variant={isNotFound ? "default" : "destructive"}>
				<AlertTitle>{isNotFound ? "Project not found" : "Error"}</AlertTitle>
				<AlertDescription>
					{msg}{" "}
					<Link
						className="underline hover:text-[var(--color-accent-fg)]"
						to="/settings/projects"
					>
						Back to projects
					</Link>
				</AlertDescription>
			</Alert>
		);
	}
	const project = projectQuery.data;

	if (editing) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-2 text-sm">
					<Link
						className="text-muted-foreground hover:text-[var(--color-accent-fg)] hover:underline"
						to="/settings/projects"
					>
						Projects
					</Link>
					<span className="text-muted-foreground/40">/</span>
					<span className="text-foreground">{project.name}</span>
				</div>
				<Card>
					<CardHeader className="border-b bg-muted/50">
						<CardTitle className="font-semibold text-base">
							Edit project
						</CardTitle>
						<CardDescription className="text-sm">
							Update project details.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-4">
						<ProjectForm
							defaultValues={{
								description: project.description ?? "",
								id: project.id,
								name: project.name,
								status: project.status,
							}}
							loading={updateMut.isPending}
							onCancel={() => setEditing(false)}
							onSubmit={async (values) => {
								await updateMut.mutateAsync({ ...values, id: project.id });
							}}
							submitLabel="Update"
						/>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-sm">
				<Link
					className="text-muted-foreground hover:text-[var(--color-accent-fg)] hover:underline"
					to="/settings/projects"
				>
					Projects
				</Link>
				<span className="text-muted-foreground/40">/</span>
				<span className="text-foreground">{project.name}</span>
			</div>
			<Card>
				<CardHeader className="flex flex-row items-start justify-between border-b bg-muted/50">
					<div>
						<CardTitle className="font-semibold text-xl">
							{project.name}
						</CardTitle>
						{project.description ? (
							<CardDescription className="mt-1.5 max-w-2xl text-muted-foreground text-sm">
								{project.description}
							</CardDescription>
						) : null}
					</div>
					<Button onClick={() => setEditing(true)} size="sm" variant="outline">
						Edit
					</Button>
				</CardHeader>
				<CardContent className="space-y-6 pt-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={project.status === "active" ? "success" : "outline"}
						>
							{project.status}
						</Badge>
						<span className="text-muted-foreground text-xs">
							Created{" "}
							{new Date(project.createdAt).toLocaleDateString("en-US", {
								timeZone: "UTC",
							})}{" "}
							• Updated{" "}
							{new Date(project.updatedAt).toLocaleDateString("en-US", {
								timeZone: "UTC",
							})}
						</span>
					</div>
					<p className="text-muted-foreground text-xs">
						Slug:{" "}
						<code className="rounded bg-muted px-1 py-0.5">{project.slug}</code>{" "}
						· URL:{" "}
						<code className="rounded bg-muted px-1 py-0.5">
							/{project.slug}/dashboard
						</code>
					</p>
					<div className="flex gap-2">
						<Button asChild={true} size="sm" variant="primary">
							<Link
								params={{ projectSlug: project.slug }}
								to="/$projectSlug/dashboard"
							>
								Open workspace
							</Link>
						</Button>
						<Button asChild={true} size="sm" variant="outline">
							<Link
								params={{ projectSlug: project.slug }}
								to="/$projectSlug/documents"
							>
								Documents
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
