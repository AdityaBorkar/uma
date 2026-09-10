import { useState } from "react";

import { DocumentEditor } from "#/components/documents/Editor.tsx";
import { MetadataForm } from "#/components/documents/MetadataForm.tsx";
import {
	cleanMeta,
	parseLabels,
	useDocumentDraft,
	validateDraft,
} from "#/components/documents/useDocumentDraft.ts";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { kindLabel } from "#/schemas/schema.ts";

export interface DocumentFormValues {
	body: string;
	labels: string[];
	meta?: Record<string, unknown>;
	title: string;
}

export interface DocumentFormInitial {
	body: string;
	/** Kind and project are fixed at creation — shown locked, never edited. */
	kind: string;
	labels: string[];
	meta?: Record<string, unknown>;
	projectName: string | null;
	title: string;
}

/**
 * Editor form for an existing document (`/$projectSlug/documents/$number/edit`).
 * Creation goes through the stub-then-edit flow on the detail page, so kind
 * and project are always locked here.
 */
export function DocumentForm({
	initial,
	loading,
	onCancel,
	onSubmit,
	submitLabel,
}: {
	initial: DocumentFormInitial;
	loading: boolean;
	onCancel: () => void;
	onSubmit: (values: DocumentFormValues) => Promise<void>;
	submitLabel: string;
}) {
	const {
		state,
		setBody,
		setLabelsText,
		setMeta,
		setTitle,
		switchMode,
		clearDirty,
	} = useDocumentDraft({
		body: initial.body,
		labels: initial.labels,
		meta: initial.meta ?? {},
		title: initial.title,
	});
	const [error, setError] = useState<string | null>(null);

	const submitText = loading ? "Saving…" : submitLabel;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		const invalid = validateDraft(state.title, state.body);
		if (invalid) {
			setError(invalid);
			return;
		}
		// "Not set" controls submit nothing — empty strings would fail the
		// kind's Zod schema server-side.
		try {
			await onSubmit({
				body: state.body,
				labels: parseLabels(state.labelsText),
				meta: cleanMeta(state.meta),
				title: state.title.trim(),
			});
			clearDirty();
		} catch (submitError) {
			// Frontmatter/MDX violations surface here as recoverable messages.
			setError(
				submitError instanceof Error
					? submitError.message
					: "Something went wrong",
			);
		}
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="doc-kind">Kind</Label>
					<Input
						disabled={true}
						id="doc-kind"
						value={kindLabel(initial.kind)}
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor="doc-title">Title</Label>
					<Input
						id="doc-title"
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Auth flow specification"
						value={state.title}
					/>
				</div>
			</div>

			<MetadataForm kind={initial.kind} onChange={setMeta} value={state.meta} />

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="doc-labels">Labels</Label>
					<Input
						id="doc-labels"
						onChange={(e) => setLabelsText(e.target.value)}
						placeholder="api, urgent"
						value={state.labelsText}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="doc-project">Project (locked)</Label>
					<Input
						disabled={true}
						id="doc-project"
						value={initial.projectName ?? "—"}
					/>
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor={state.mode === "source" ? "doc-body" : undefined}>
						Body
					</Label>
					<div className="flex items-center gap-1 text-muted-foreground text-xs">
						<Button
							className={
								state.mode === "rich" ? "bg-accent text-accent-foreground" : ""
							}
							onClick={() => switchMode("rich")}
							size="sm"
							type="button"
							variant="ghost"
						>
							Rich
						</Button>
						<Button
							className={
								state.mode === "source"
									? "bg-accent text-accent-foreground"
									: ""
							}
							onClick={() => switchMode("source")}
							size="sm"
							type="button"
							variant="ghost"
						>
							Source
						</Button>
					</div>
				</div>
				{state.mode === "rich" ? (
					<DocumentEditor
						initialHtml={state.richHtml}
						key={`form-${state.mode}-${state.revision}`}
						onChange={(mdx) => setBody(mdx)}
					/>
				) : (
					<textarea
						className="h-80 w-full resize-y rounded-md border bg-background p-3 font-mono text-sm"
						id="doc-body"
						onChange={(e) => setBody(e.target.value)}
						spellCheck={false}
						value={state.body}
					/>
				)}
				<p className="text-muted-foreground text-xs">
					{state.mode === "rich"
						? "Formatting is saved as MDX. Kind-specific fields above are stored as JSONB metadata — no YAML involved."
						: "Raw MDX with GFM tables and #<number> references. Imports, expressions, and JSX components are rejected at render time."}
				</p>
				{state.notice ? (
					<p className="text-amber-600 text-xs dark:text-amber-400">
						{state.notice}
					</p>
				) : null}
			</div>

			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			<div className="flex justify-end gap-2">
				<Button onClick={onCancel} type="button" variant="ghost">
					Cancel
				</Button>
				<Button disabled={loading} type="submit">
					{submitText}
				</Button>
			</div>
		</form>
	);
}
