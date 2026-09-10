import { Link } from "@tanstack/react-router";

import { stateBadgeClass } from "#/components/badges.ts";
import type { DocumentDraft } from "#/components/documents/useDocumentDraft.ts";
import type { RenderedDocument } from "#/components/documents.fns.ts";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { formatAgo } from "#/lib/age.ts";
import { kindLabel } from "#/schemas/schema.ts";

interface Props {
	canEdit: boolean;
	doc: RenderedDocument;
	draft: DocumentDraft;
	isSaving: boolean;
	onCancel: () => void;
	onClose: () => void;
	onDelete: () => void;
	onReopen: () => void;
	onSave: () => void;
	onSwitchSourceMode: () => void;
	pendingClose: boolean;
	pendingDelete: boolean;
	pendingReopen: boolean;
	projectSlug: string;
}

export function DocumentHeader({
	canEdit,
	doc,
	draft,
	isSaving,
	onCancel,
	onClose,
	onDelete,
	onReopen,
	onSave,
	onSwitchSourceMode,
	pendingClose,
	pendingDelete,
	pendingReopen,
	projectSlug,
}: Props) {
	const { state } = draft;
	const projectLabel = doc.projectId
		? ` · ${doc.projectName ?? doc.projectId} (locked)`
		: "";

	return (
		<>
			<div className="flex items-center gap-2 text-sm">
				<Link
					className="text-muted-foreground hover:text-[var(--color-accent-fg)] hover:underline"
					params={{ projectSlug }}
					to="/$projectSlug/documents"
				>
					Documents
				</Link>
				<span className="text-muted-foreground/40">/</span>
				<span className="text-foreground">#{doc.number}</span>
				{state.dirty ? (
					<span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-300">
						Unsaved
					</span>
				) : null}
			</div>

			<div className="flex flex-col gap-3 border-b pb-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground text-xs">
								#{doc.number}
							</span>
							<Badge className={stateBadgeClass(doc.state)} variant="secondary">
								{doc.state}
							</Badge>
							<Badge variant="outline">{kindLabel(doc.kind)}</Badge>
							{doc.labels.map((label) => (
								<Badge key={label} variant="outline">
									{label}
								</Badge>
							))}
						</div>
						{canEdit ? (
							<Input
								className="h-auto border-transparent bg-transparent px-0 font-semibold text-xl tracking-tight shadow-none focus-visible:border-input focus-visible:bg-background focus-visible:px-3 focus-visible:ring-0"
								onChange={(e) => draft.setTitle(e.target.value)}
								placeholder="Document title"
								value={state.title}
							/>
						) : (
							<h1 className="font-semibold text-xl tracking-tight">
								{doc.title}
							</h1>
						)}
						<p className="text-muted-foreground text-xs">
							opened {formatAgo(doc.createdAt)} · updated{" "}
							{formatAgo(doc.updatedAt)}
							{projectLabel} ·{kindLabel(doc.kind)} locked
						</p>
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{canEdit ? (
							<>
								<Button
									disabled={!state.dirty || isSaving}
									onClick={onSave}
									size="sm"
									variant="primary"
								>
									{isSaving ? "Saving…" : "Save"}
								</Button>
								<Button
									disabled={!state.dirty || isSaving}
									onClick={onCancel}
									size="sm"
									variant="ghost"
								>
									Cancel
								</Button>
							</>
						) : null}
						{doc.state === "open" ? (
							<Button
								disabled={pendingClose}
								onClick={onClose}
								size="sm"
								variant="primary"
							>
								Close
							</Button>
						) : (
							<>
								<Button
									disabled={pendingReopen}
									onClick={onReopen}
									size="sm"
									variant="outline"
								>
									Reopen
								</Button>
								<Button
									disabled={pendingDelete}
									onClick={onDelete}
									size="sm"
									variant="ghost"
								>
									Delete
								</Button>
							</>
						)}
					</div>
				</div>

				{state.saveError ? (
					<p className="text-destructive text-sm">{state.saveError}</p>
				) : null}
				{state.notice ? (
					<p className="text-amber-600 text-xs dark:text-amber-400">
						{state.notice}
					</p>
				) : null}
				{doc.error ? (
					<div className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm">
						<p className="font-medium text-destructive">
							This document failed to render
						</p>
						<p className="text-muted-foreground text-xs">{doc.error}</p>
						{canEdit && state.mode !== "source" ? (
							<Button
								className="mt-2"
								onClick={onSwitchSourceMode}
								size="sm"
								variant="outline"
							>
								Open raw source
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</>
	);
}
