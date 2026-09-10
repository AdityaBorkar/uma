import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useState } from "react";

import { useProjectOptions } from "#/components/lists/shared.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Select } from "#/components/ui/select.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { useWorkspace } from "#/components/workspace.tsx";
import { rpc, rpcPathKey } from "#/lib/rpc.ts";
import {
	DOCUMENT_KINDS,
	type DocumentKind,
	kindLabel,
} from "#/schemas/schema.ts";

export const Route = createFileRoute("/(app)/$projectSlug/documents/new")({
	component: NewDocumentPage,
});

function NewDocumentPage() {
	const ws = useWorkspace();
	const navigate = useNavigate();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [kind, setKind] = useState<DocumentKind>("wiki");
	const [projectId, setProjectId] = useState(ws.isMulti ? "" : ws.projectId);
	const [error, setError] = useState<string | null>(null);

	const { options: projects, query: projectsQuery } = useProjectOptions();

	const createMut = useMutation(
		rpc.documents.create.mutationOptions({
			onError: (e: unknown) => {
				setError(e instanceof Error ? e.message : "Failed to create document");
			},
			onSuccess: (doc) => {
				void queryClient.invalidateQueries({
					queryKey: rpcPathKey(rpc.documents.list.key()),
				});
				posthog.capture("document_created", { bytes: doc.body.length, kind });
				toast({ description: `#${doc.number}`, title: "Document created" });
				void navigate({
					params: { number: String(doc.number), projectSlug: ws.projectSlug },
					to: "/$projectSlug/documents/$number",
				});
			},
		}),
	);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		if (createMut.isPending) {
			return;
		}
		setError(null);
		if (!projectId) {
			setError(
				"Project is required — pick the project this document belongs to. Type and Project are locked after creation.",
			);
			return;
		}
		const title = `Untitled ${kindLabel(kind)}`;
		const body =
			"_Draft — fill in details in the editor. Kind and project are locked._\n\n## Summary\n\n";

		try {
			await createMut.mutateAsync({
				body,
				kind,
				projectId,
				title,
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create document");
		}
	}

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">New document</h1>
				<p className="text-muted-foreground text-sm">
					Choose <span className="font-medium text-foreground">Type</span> and{" "}
					<span className="font-medium text-foreground">Project</span> — they
					are locked after creation. Title, body, labels and everything else can
					be filled in after.
				</p>
			</div>
			<Card className="overflow-hidden">
				<CardContent className="py-4">
					<form className="space-y-4" onSubmit={handleCreate}>
						<div className="space-y-2">
							<Label htmlFor="doc-kind">Type</Label>
							<Select
								id="doc-kind"
								onChange={(e) => setKind(e.target.value as DocumentKind)}
								value={kind}
							>
								{DOCUMENT_KINDS.map((k) => (
									<option key={k.value} value={k.value}>
										{k.label}
									</option>
								))}
							</Select>
							<p className="text-muted-foreground text-xs">
								Locked after creation — determines validation and view.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="doc-project">Project *</Label>
							<Select
								id="doc-project"
								onChange={(e) => setProjectId(e.target.value)}
								value={projectId}
							>
								<option value="">Select a project</option>
								{projects.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</Select>
							<p className="text-muted-foreground text-xs">
								Locked after creation.{" "}
								{projectsQuery.isPending
									? "Loading projects…"
									: projects.length === 0
										? "No projects yet —"
										: ""}{" "}
								{projects.length === 0 && !projectsQuery.isPending ? (
									<Link className="underline" to="/settings/projects/new">
										create a project first
									</Link>
								) : null}
							</p>
						</div>

						{error ? <p className="text-destructive text-sm">{error}</p> : null}

						<div className="-mx-4 mt-4 -mb-4 flex justify-end gap-2 border-t bg-muted/50 px-4 py-3">
							<Button
								onClick={() =>
									void navigate({
										params: { projectSlug: ws.projectSlug },
										to: "/$projectSlug/documents",
									})
								}
								type="button"
								variant="ghost"
							>
								Cancel
							</Button>
							<Button
								disabled={createMut.isPending || projectsQuery.isPending}
								type="submit"
								variant="primary"
							>
								{createMut.isPending ? "Creating…" : "Create document"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
