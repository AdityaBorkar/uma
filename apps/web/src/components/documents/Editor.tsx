import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";

import {
	Bold,
	Code,
	Heading2,
	Heading3,
	Heading4,
	type IconComponent,
	Italic,
	Link2,
	List,
	ListOrdered,
	ListTodo,
	Minus,
	Plus,
	Quote,
	Redo2,
	SquareCode,
	Strikethrough,
	TableIcon,
	Undo2,
} from "#/components/icons.tsx";
import { htmlToMdx } from "#/components/mdx-editor.ts";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { cn } from "#/lib/utils.ts";

/**
 * Rich-text composer for Documents (docs/adr/004-documents-single-primitive.md
 * §5). The extension list is the allowlisted node set — deliberately no
 * richer than what src/lib/mdx.server.ts renders. The editor never holds
 * frontmatter; metadata lives in DocumentForm's controls.
 */

const CODE_LANGUAGES = [
	"bash",
	"go",
	"json",
	"python",
	"rust",
	"sql",
	"ts",
	"tsx",
	"yaml",
] as const;

function ToolButton({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active?: boolean;
	icon: IconComponent;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			aria-label={label}
			aria-pressed={active}
			className={cn(active && "bg-accent text-accent-foreground")}
			onClick={onClick}
			size="icon-sm"
			title={label}
			type="button"
			variant="ghost"
		>
			<Icon />
		</Button>
	);
}

function ToolbarDivider() {
	return <div aria-hidden={true} className="mx-1 h-5 w-px bg-border" />;
}

export function DocumentEditor({
	className,
	initialHtml = "",
	onChange,
	placeholder = "Write the body — headings, lists, code, tables. Metadata lives in the form fields above.",
}: {
	className?: string;
	initialHtml?: string;
	onChange?: (mdx: string) => void;
	placeholder?: string;
}) {
	const [linkOpen, setLinkOpen] = useState(false);
	const [href, setHref] = useState("");

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
					"prose prose-sm dark:prose-invert max-w-none min-h-72 px-4 py-3 focus:outline-none",
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

	const chain = () => editor.chain().focus();

	function openLinkPopover() {
		setHref((editor?.getAttributes("link").href as string) ?? "");
		setLinkOpen(true);
	}

	function applyLink() {
		let url = href.trim();
		if (url && !url.startsWith("#") && !/^https?:\/\//.exec(url)) {
			url = `https://${url}`;
		}
		if (url) {
			chain().extendMarkRange("link").setLink({ href: url }).run();
		} else {
			chain().extendMarkRange("link").unsetLink().run();
		}
		setLinkOpen(false);
	}

	return (
		<div
			className={cn(
				"overflow-hidden rounded-md border bg-background",
				className,
			)}
		>
			<div className="relative flex flex-wrap items-center gap-0.5 border-b p-1.5">
				<ToolButton
					active={editor.isActive("bold")}
					icon={Bold}
					label="Bold"
					onClick={() => chain().toggleBold().run()}
				/>
				<ToolButton
					active={editor.isActive("italic")}
					icon={Italic}
					label="Italic"
					onClick={() => chain().toggleItalic().run()}
				/>
				<ToolButton
					active={editor.isActive("strike")}
					icon={Strikethrough}
					label="Strikethrough"
					onClick={() => chain().toggleStrike().run()}
				/>
				<ToolButton
					active={editor.isActive("code")}
					icon={Code}
					label="Inline code"
					onClick={() => chain().toggleCode().run()}
				/>
				<ToolbarDivider />
				<ToolButton
					active={editor.isActive("heading", { level: 2 })}
					icon={Heading2}
					label="Heading 2"
					onClick={() => chain().toggleHeading({ level: 2 }).run()}
				/>
				<ToolButton
					active={editor.isActive("heading", { level: 3 })}
					icon={Heading3}
					label="Heading 3"
					onClick={() => chain().toggleHeading({ level: 3 }).run()}
				/>
				<ToolButton
					active={editor.isActive("heading", { level: 4 })}
					icon={Heading4}
					label="Heading 4"
					onClick={() => chain().toggleHeading({ level: 4 }).run()}
				/>
				<ToolbarDivider />
				<ToolButton
					active={editor.isActive("bulletList")}
					icon={List}
					label="Bullet list"
					onClick={() => chain().toggleBulletList().run()}
				/>
				<ToolButton
					active={editor.isActive("orderedList")}
					icon={ListOrdered}
					label="Numbered list"
					onClick={() => chain().toggleOrderedList().run()}
				/>
				<ToolButton
					active={editor.isActive("taskList")}
					icon={ListTodo}
					label="Task list"
					onClick={() => chain().toggleTaskList().run()}
				/>
				<ToolButton
					active={editor.isActive("blockquote")}
					icon={Quote}
					label="Quote"
					onClick={() => chain().toggleBlockquote().run()}
				/>
				<ToolButton
					active={editor.isActive("codeBlock")}
					icon={SquareCode}
					label="Code block"
					onClick={() =>
						editor.isActive("codeBlock")
							? chain().setParagraph().run()
							: chain().toggleCodeBlock().run()
					}
				/>
				{editor.isActive("codeBlock") ? (
					<Select
						aria-label="Code language"
						className="h-8 w-28 py-0 text-xs"
						onChange={(e) =>
							chain()
								.updateAttributes("codeBlock", {
									language: e.target.value || null,
								})
								.run()
						}
						value={(editor.getAttributes("codeBlock").language as string) ?? ""}
					>
						<option value="">plain</option>
						{CODE_LANGUAGES.map((lang) => (
							<option key={lang} value={lang}>
								{lang}
							</option>
						))}
					</Select>
				) : null}
				<ToolbarDivider />
				<ToolButton
					active={editor.isActive("link")}
					icon={Link2}
					label="Link"
					onClick={openLinkPopover}
				/>
				<ToolButton
					active={editor.isActive("table")}
					icon={TableIcon}
					label="Table"
					onClick={() =>
						editor.isActive("table")
							? chain().deleteTable().run()
							: chain()
									.insertTable({ cols: 3, rows: 3, withHeaderRow: true })
									.run()
					}
				/>
				{editor.isActive("table") ? (
					<>
						<ToolButton
							icon={Minus}
							label="Delete row"
							onClick={() => chain().deleteRow().run()}
						/>
						<ToolButton
							icon={Plus}
							label="Add row"
							onClick={() => chain().addRowAfter().run()}
						/>
					</>
				) : null}
				<ToolButton
					icon={Minus}
					label="Horizontal rule"
					onClick={() => chain().setHorizontalRule().run()}
				/>
				<div className="ml-auto flex items-center gap-0.5">
					<ToolButton
						icon={Undo2}
						label="Undo"
						onClick={() => chain().undo().run()}
					/>
					<ToolButton
						icon={Redo2}
						label="Redo"
						onClick={() => chain().redo().run()}
					/>
				</div>

				{linkOpen ? (
					<div className="absolute top-full right-2 z-10 mt-1 flex items-center gap-1 rounded-md border bg-background p-1.5 shadow-md">
						<Input
							aria-label="Link URL"
							className="h-7 w-56 text-xs"
							onChange={(e) => setHref(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									applyLink();
								}
								if (e.key === "Escape") {
									setLinkOpen(false);
								}
							}}
							placeholder="https://… or #42 for a document"
							value={href}
						/>
						<Button
							className="h-7 text-xs"
							onClick={applyLink}
							size="sm"
							type="button"
						>
							Apply
						</Button>
						{editor.isActive("link") ? (
							<Button
								className="h-7 text-xs"
								onClick={() => {
									chain().extendMarkRange("link").unsetLink().run();
									setLinkOpen(false);
								}}
								size="sm"
								type="button"
								variant="ghost"
							>
								Remove
							</Button>
						) : null}
					</div>
				) : null}
			</div>

			<EditorContent editor={editor} />
		</div>
	);
}
