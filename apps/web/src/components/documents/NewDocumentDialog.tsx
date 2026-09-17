import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

import { FormDialog } from "#/components/forms/FormDialog.tsx";
import { FormField } from "#/components/forms/FormField.tsx";
import { useProjectOptions } from "#/components/lists/shared.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Select } from "#/components/ui/select.tsx";
import { useToast } from "#/components/ui/toaster.tsx";
import { useWorkspace } from "#/components/workspace.tsx";
import { rpc } from "#/lib/rpc.ts";
import {
	DOCUMENT_KINDS,
	type DocumentKind,
	kindLabel,
} from "#/schemas/schema.ts";
import { invalidateDocuments } from "#/stores/invalidation.ts";

/**
 * Creation dialog for a document (replaces the former `/documents/new` page).
 *
 * Scope is the URL `$projectSlug` via `useWorkspace()` — the source of truth
 * per CONTEXT.md. In a single-project scope the project is fixed to the
 * current project and the Project field is hidden; in the Multi-Project
 * scope (`~`) the caller must pick a project.
 */
export function NewDocumentDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const ws = useWorkspace();
	const navigate = useNavigate();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [kind, setKind] = useState<DocumentKind>("wiki");
	const [projectId, setProjectId] = useState(ws.isMulti ? "" : ws.projectId);
	const [error, setError] = useState<string | null>(null);

	const { options: projects, query: projectsQuery } = useProjectOptions();
	const lockedProjectId = ws.isMulti ? null : ws.projectId;

	// Sync the locked project every time the dialog opens in single scope.
	useEffect(() => {
		if (open && lockedProjectId !== null) {
			setProjectId(lockedProjectId);
		}
		if (open) {
			setError(null);
		}
	}, [open, lockedProjectId]);

	const createMut = useMutation(
		rpc.documents.create.mutationOptions({
			onError: (e: unknown) => {
				setError(e instanceof Error ? e.message : "Failed to create document");
			},
			onSuccess: (doc) => {
				invalidateDocuments(queryClient);
				posthog.capture("document_created", { bytes: doc.body.length, kind });
				toast({ description: `#${doc.number}`, title: "Document created" });
				onOpenChange(false);
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
		const effectiveProjectId = ws.isMulti ? projectId : ws.projectId;
		if (!effectiveProjectId) {
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
				projectId: effectiveProjectId,
				title,
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create document");
		}
	}

	return (
		<FormDialog
			description="Type and Project are locked after creation. Title, body, labels and everything else can be filled in after."
			onClose={() => onOpenChange(false)}
			onOpenChange={onOpenChange}
			open={open}
			title="New document"
		>
			<form className="space-y-4" onSubmit={handleCreate}>
				<FormField
					hint="Locked after creation — determines validation and view."
					id="doc-kind"
					label="Type"
				>
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
				</FormField>

				{ws.isMulti ? (
					<FormField
						hint={
							<>
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
							</>
						}
						id="doc-project"
						label="Project"
						required={true}
					>
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
					</FormField>
				) : (
					<p className="text-muted-foreground text-xs">
						Creating in {ws.project.name} — project is locked after creation.
					</p>
				)}

				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				<div className="flex justify-end gap-2 pt-2">
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={
							createMut.isPending || (ws.isMulti && projectsQuery.isPending)
						}
						type="submit"
						variant="primary"
					>
						{createMut.isPending ? "Creating…" : "Create document"}
					</Button>
				</div>
			</form>
		</FormDialog>
	);
}
