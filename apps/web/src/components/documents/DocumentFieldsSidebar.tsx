import { useSelector } from "@tanstack/react-store";

import { MetadataForm } from "#/components/documents/MetadataForm.tsx";
import { Lock } from "#/components/icons.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Label } from "#/components/ui/label.tsx";
import { Separator } from "#/components/ui/separator.tsx";
import { formatAgo } from "#/lib/age.ts";
import { kindLabel } from "#/schemas/schema.ts";
import {
	type DraftStore,
	setDraftLabelsText,
	setDraftMeta,
} from "#/stores/draft.ts";

interface Props {
	canEdit: boolean;
	createdAt: string;
	draftStore: DraftStore;
	isSaving: boolean;
	kind: string;
	onReset: () => void;
	onSave: () => void;
	projectName: string | null;
	updatedAt: string;
}

export function DocumentFieldsSidebar({
	canEdit,
	createdAt,
	draftStore,
	isSaving,
	kind,
	onReset,
	onSave,
	projectName,
	updatedAt,
}: Props) {
	const labelsText = useSelector(draftStore, (s) => s.labelsText);
	const meta = useSelector(draftStore, (s) => s.meta);
	const dirty = useSelector(draftStore, (s) => s.dirty);

	return (
		<Card>
			<CardContent className="space-y-4 p-4">
				<h3 className="font-semibold text-sm">Fields</h3>

				<div className="space-y-2">
					<Label htmlFor="doc-field-kind">Kind</Label>
					<div className="relative">
						<Input
							className="pr-9"
							disabled={true}
							id="doc-field-kind"
							value={kindLabel(kind)}
						/>
						<Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="doc-field-project">Project</Label>
					<div className="relative">
						<Input
							className="pr-9"
							disabled={true}
							id="doc-field-project"
							value={projectName ?? "—"}
						/>
						<Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="doc-field-labels">Labels</Label>
					<Input
						disabled={!canEdit}
						id="doc-field-labels"
						onChange={(e) => setDraftLabelsText(draftStore, e.target.value)}
						placeholder="api, urgent"
						value={labelsText}
					/>
					<p className="text-micro text-muted-foreground">
						Comma-separated, ≤20
					</p>
				</div>

				<div className={canEdit ? undefined : "pointer-events-none opacity-60"}>
					<MetadataForm
						kind={kind}
						onChange={(next) => setDraftMeta(draftStore, next)}
						value={meta}
					/>
				</div>

				{canEdit ? (
					<div className="flex gap-2 pt-2">
						<Button
							className="flex-1"
							disabled={!dirty || isSaving}
							onClick={onSave}
							size="sm"
							variant="primary"
						>
							{isSaving ? "Saving…" : "Save fields"}
						</Button>
						<Button
							disabled={!dirty}
							onClick={onReset}
							size="sm"
							variant="ghost"
						>
							Reset
						</Button>
					</div>
				) : null}

				<Separator />
				<div className="space-y-2">
					<Label htmlFor="doc-field-activity">Activity</Label>
					<div className="relative">
						<Input
							className="pr-9"
							disabled={true}
							id="doc-field-activity"
							value={`opened ${formatAgo(createdAt)} · updated ${formatAgo(updatedAt)}`}
						/>
						<Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
