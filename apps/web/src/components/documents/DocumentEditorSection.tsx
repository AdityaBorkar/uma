import { useSelector } from "@tanstack/react-store";

import { DocumentEditor } from "#/components/documents/Editor.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Label } from "#/components/ui/label.tsx";
import {
	type DraftStore,
	setDraftBody,
	switchDraftMode,
} from "#/stores/draft.ts";

function SanitizedHtml({ html }: { html: string | null }) {
	// docHtml is server-rendered through the mdx.server.ts allowlist
	// (#/components/mdx.server.ts) — trusted sink sanitized server-side.
	return (
		<div
			className="prose prose-sm prose-invert max-w-none"
			// react-doctor-disable-next-line react-doctor/dangerous-html-sink -- html is static output of mdx.server.ts allowlist
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Exception
			dangerouslySetInnerHTML={{ __html: html ?? "" }}
		/>
	);
}

interface Props {
	canEdit: boolean;
	docHtml: string | null;
	draftStore: DraftStore;
	isClosed: boolean;
	rawNumber: number;
}

/**
 * Body section without card chrome: the rich editor and the source textarea
 * already carry their own borders, so a wrapping Card only doubled them.
 * Subscribes only to body/mode/revision — title/labels/meta edits elsewhere
 * do not remount or re-render the editor.
 */
export function DocumentEditorSection({
	canEdit,
	docHtml,
	draftStore,
	isClosed,
	rawNumber,
}: Props) {
	const mode = useSelector(draftStore, (s) => s.mode);
	const body = useSelector(draftStore, (s) => s.body);
	const richHtml = useSelector(draftStore, (s) => s.richHtml);
	const revision = useSelector(draftStore, (s) => s.revision);

	if (isClosed) {
		return (
			<div className="rounded-md border bg-card px-4 py-3">
				<SanitizedHtml html={docHtml} />
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{canEdit ? (
				<div className="flex items-center justify-end gap-1">
					<Button
						className={
							mode === "rich" ? "bg-accent text-accent-foreground" : ""
						}
						onClick={() => switchDraftMode(draftStore, "rich")}
						size="sm"
						type="button"
						variant="ghost"
					>
						Rich
					</Button>
					<Button
						className={
							mode === "source" ? "bg-accent text-accent-foreground" : ""
						}
						onClick={() => switchDraftMode(draftStore, "source")}
						size="sm"
						type="button"
						variant="ghost"
					>
						Source
					</Button>
				</div>
			) : null}

			{mode === "rich" ? (
				<DocumentEditor
					initialHtml={richHtml}
					key={`${rawNumber}-${mode}-${revision}`}
					onChange={(mdx) => setDraftBody(draftStore, mdx)}
				/>
			) : (
				<div>
					<Label className="sr-only" htmlFor="doc-body">
						Document body — MDX source
					</Label>
					<textarea
						aria-label="Document body (MDX source)"
						className="h-130 w-full resize-y rounded-md border bg-background p-3 font-mono text-sm"
						id="doc-body"
						onChange={(e) => setDraftBody(draftStore, e.target.value)}
						spellCheck={false}
						value={body}
					/>
					<p className="mt-2 text-muted-foreground text-xs">
						Raw MDX with GFM tables and #&lt;number&gt; references. Imports,
						expressions, and JSX components are rejected at render time.
					</p>
				</div>
			)}
		</div>
	);
}
