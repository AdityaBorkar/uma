import { DocumentEditor } from "#/components/documents/Editor.tsx";
import type { DocumentDraft } from "#/components/documents/useDocumentDraft.ts";
import { Button } from "#/components/ui/button.tsx";
import { Label } from "#/components/ui/label.tsx";

function SanitizedHtml({ html }: { html: string | null }) {
	// docHtml is server-rendered through the mdx.server.ts allowlist
	// (#/components/mdx.server.ts) — trusted sink sanitized server-side.
	return (
		<div
			className="prose prose-sm dark:prose-invert max-w-none"
			// react-doctor-disable-next-line react-doctor/dangerous-html-sink -- html is static output of mdx.server.ts allowlist
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Exception
			dangerouslySetInnerHTML={{ __html: html ?? "" }}
		/>
	);
}

interface Props {
	canEdit: boolean;
	docHtml: string | null;
	draft: DocumentDraft;
	isClosed: boolean;
	rawNumber: number;
}

/**
 * Body section without card chrome: the rich editor and the source textarea
 * already carry their own borders, so a wrapping Card only doubled them.
 * The only chrome is the Rich/Source switch; status (dirty/saved) lives in
 * the page header's Unsaved pill, not a footer bar.
 */
export function DocumentEditorSection({
	canEdit,
	docHtml,
	draft,
	isClosed,
	rawNumber,
}: Props) {
	const { state } = draft;

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
							state.mode === "rich" ? "bg-accent text-accent-foreground" : ""
						}
						onClick={() => draft.switchMode("rich")}
						size="sm"
						type="button"
						variant="ghost"
					>
						Rich
					</Button>
					<Button
						className={
							state.mode === "source" ? "bg-accent text-accent-foreground" : ""
						}
						onClick={() => draft.switchMode("source")}
						size="sm"
						type="button"
						variant="ghost"
					>
						Source
					</Button>
				</div>
			) : null}

			{state.mode === "rich" ? (
				<DocumentEditor
					initialHtml={state.richHtml}
					key={`${rawNumber}-${state.mode}-${state.revision}`}
					onChange={draft.setBody}
				/>
			) : (
				<div>
					<Label className="sr-only" htmlFor="doc-body">
						Document body — MDX source
					</Label>
					<textarea
						aria-label="Document body (MDX source)"
						className="h-[520px] w-full resize-y rounded-md border bg-background p-3 font-mono text-sm"
						id="doc-body"
						onChange={(e) => draft.setBody(e.target.value)}
						spellCheck={false}
						value={state.body}
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
