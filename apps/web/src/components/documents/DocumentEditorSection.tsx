import { DocumentEditor } from "#/components/documents/Editor.tsx";
import type { DocumentDraft } from "#/components/documents/useDocumentDraft.ts";
import { Button } from "#/components/ui/button.tsx";
import { Card, CardContent } from "#/components/ui/card.tsx";
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

export function DocumentEditorSection({
	canEdit,
	docHtml,
	draft,
	isClosed,
	rawNumber,
}: Props) {
	const { state } = draft;
	return (
		<Card className="overflow-hidden">
			<div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Body {isClosed ? "· read-only" : "· WYSIWYG"}
				</span>
				{canEdit ? (
					<div className="flex items-center gap-1">
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
								state.mode === "source"
									? "bg-accent text-accent-foreground"
									: ""
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
			</div>

			{isClosed ? (
				<CardContent className="pt-4">
					<SanitizedHtml html={docHtml} />
				</CardContent>
			) : state.mode === "rich" ? (
				<DocumentEditor
					initialHtml={state.richHtml}
					key={`${rawNumber}-${state.mode}-${state.revision}`}
					onChange={draft.setBody}
				/>
			) : (
				<div className="p-3">
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

			{canEdit ? (
				<div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-xs">
					<span className="text-muted-foreground">
						{state.mode === "rich"
							? "Formatting is saved as MDX. What you see is what is saved."
							: "Source mode — rich preview unavailable."}
					</span>
					<span className="text-muted-foreground">
						{state.dirty ? "Unsaved changes" : "All changes saved"}
					</span>
				</div>
			) : null}
		</Card>
	);
}
