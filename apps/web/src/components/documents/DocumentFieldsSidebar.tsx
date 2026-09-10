import { MetadataForm } from "#/components/documents/MetadataForm.tsx";
import type { DocumentDraft } from "#/components/documents/useDocumentDraft.ts";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Separator } from "#/components/ui/separator.tsx";
import { kindLabel } from "#/schemas/schema.ts";

interface Props {
	canEdit: boolean;
	draft: DocumentDraft;
	isSaving: boolean;
	kind: string;
	onReset: () => void;
	onSave: () => void;
	projectName: string | null;
}

export function DocumentFieldsSidebar({
	canEdit,
	draft,
	isSaving,
	kind,
	onReset,
	onSave,
	projectName,
}: Props) {
	const { state } = draft;
	return (
		<Card>
			<CardContent className="space-y-4 p-4">
				<h3 className="font-semibold text-sm">Fields</h3>
				<p className="text-muted-foreground text-xs">
					Frontmatter is stored as JSONB — edit fields here, body stays WYSIWYG
					on the left.
				</p>
				<Separator />

				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label htmlFor="doc-field-kind">Kind</Label>
						<Input
							disabled={true}
							id="doc-field-kind"
							value={kindLabel(kind)}
						/>
						<p className="text-[11px] text-muted-foreground">
							Locked after creation
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="doc-field-project">Project</Label>
						<Input
							disabled={true}
							id="doc-field-project"
							value={projectName ?? "—"}
						/>
						<p className="text-[11px] text-muted-foreground">
							Locked after creation
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="doc-field-labels">Labels</Label>
					<Input
						disabled={!canEdit}
						id="doc-field-labels"
						onChange={(e) => draft.setLabelsText(e.target.value)}
						placeholder="api, urgent"
						value={state.labelsText}
					/>
					<p className="text-[11px] text-muted-foreground">
						Comma-separated, ≤20
					</p>
				</div>

				<div className={canEdit ? undefined : "pointer-events-none opacity-60"}>
					<MetadataForm
						kind={kind}
						onChange={draft.setMeta}
						value={state.meta}
					/>
				</div>

				{canEdit ? (
					<div className="flex gap-2 pt-2">
						<Button
							className="flex-1"
							disabled={!state.dirty || isSaving}
							onClick={onSave}
							size="sm"
							variant="primary"
						>
							{isSaving ? "Saving…" : "Save fields"}
						</Button>
						<Button
							disabled={!state.dirty}
							onClick={onReset}
							size="sm"
							variant="ghost"
						>
							Reset
						</Button>
					</div>
				) : null}

				{state.saveError ? (
					<p className="text-destructive text-xs">{state.saveError}</p>
				) : null}
			</CardContent>
		</Card>
	);
}
