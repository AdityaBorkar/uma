import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";

import { ProjectForm } from "#/components/projects/ProjectForm.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";

export const Route = createFileRoute("/(app)/settings/projects/new")({
	component: NewProjectPage,
});

function NewProjectPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { toast } = useToast();

	const createMut = useMutation(
		rpc.projects.create.mutationOptions({
			onError: (error: unknown) => {
				const message =
					error instanceof Error ? error.message : "Failed to create project";
				toast({ description: message, title: "Error", variant: "destructive" });
			},
			onSuccess: async (data) => {
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.projects.list.key()),
				});
				toast({ description: data.name, title: "Project created" });
				posthog.capture("project_created", { projectId: data.id });
				await navigate({
					params: { projectId: data.id },
					to: "/settings/projects/$projectId",
				});
			},
		}),
	);

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">New project</h1>
					<p className="text-muted-foreground text-sm">
						Organize your work into projects.
					</p>
				</div>
				<Button asChild={true} size="sm" variant="outline">
					<Link to="/settings/projects">Back to projects</Link>
				</Button>
			</div>
			<Card className="overflow-hidden">
				<CardHeader className="border-b bg-muted/50">
					<CardTitle className="text-sm">Details</CardTitle>
				</CardHeader>
				<CardContent>
					<ProjectForm
						loading={createMut.isPending}
						onCancel={() => void navigate({ to: "/settings/projects" })}
						onSubmit={async (values) => {
							await createMut.mutateAsync({
								description: values.description,
								name: values.name,
								status: values.status,
							});
						}}
						submitLabel="Create project"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
