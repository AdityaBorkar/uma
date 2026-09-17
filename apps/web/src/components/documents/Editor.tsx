import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { SelectionToolbar } from "#/components/documents/SelectionToolbar.tsx";
import { SlashMenu } from "#/components/documents/SlashMenu.tsx";
import { htmlToMdx } from "#/components/mdx-editor.ts";
import { cn } from "#/lib/utils.ts";

/**
 * Rich-text composer for Documents (docs/adr/004-documents-single-primitive.md
 * §5). The extension list is the allowlisted node set — deliberately no
 * richer than what src/lib/mdx.server.ts renders. The editor never holds
 * frontmatter; metadata lives in the Fields sidebar controls.
 *
 * Chrome is contextual, not a static strip: selected text gets the inline
 * formatting bubble (SelectionToolbar.tsx) and "/" opens the block-insert
 * menu (SlashMenu.tsx). Undo/redo have no buttons; the StarterKit history
 * shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) still apply.
 */

export function DocumentEditor({
	className,
	initialHtml = "",
	onChange,
	placeholder = "Write the body — select text to format, type / for headings, lists, code, and tables. Metadata lives in the form fields above.",
}: {
	className?: string;
	initialHtml?: string;
	onChange?: (mdx: string) => void;
	placeholder?: string;
}) {
	const extensions = [
		StarterKit.configure({
			// Dedicated extension below; h1 is reserved for the document title.
			heading: { levels: [2, 3, 4] },
			link: false,
			underline: false,
		}),
		Link.configure({
			autolink: true,
			HTMLAttributes: { rel: "nofollow noopener noreferrer" },
			openOnClick: false,
		}),
		TaskItem.configure({ nested: true }),
		TaskList,
		TableKit.configure({ table: { resizable: false } }),
		Placeholder.configure({ placeholder }),
	];

	const editor = useEditor({
		content: initialHtml || undefined,
		editorProps: {
			attributes: {
				class:
					"prose prose-sm prose-invert max-w-none min-h-72 px-4 py-3 focus:outline-none",
			},
		},
		extensions,
		immediatelyRender: false,
		onUpdate({ editor: current }) {
			if (!onChange) {
				return;
			}
			try {
				onChange(htmlToMdx(current.getHTML()));
			} catch {
				// Keep the last good serialization; the server allowlist is the gate.
			}
		},
	});

	if (!editor) {
		return null;
	}

	return (
		<div className={cn("relative rounded-md border bg-background", className)}>
			<EditorContent editor={editor} />
			<SelectionToolbar editor={editor} />
			<SlashMenu editor={editor} />
		</div>
	);
}
