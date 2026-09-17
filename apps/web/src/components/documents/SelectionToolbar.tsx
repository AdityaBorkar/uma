import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useState } from "react";

import {
	Bold,
	Code,
	type IconComponent,
	Italic,
	Link2,
	Strikethrough,
} from "#/components/icons.tsx";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Select } from "#/components/ui/select.tsx";
import { cn } from "#/lib/utils.ts";

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

/**
 * Inline formatting bubble — visible only while text is selected.
 * Block-level inserts (headings, lists, tables, …) live in the slash menu
 * (SlashMenu.tsx). Inside a code block, marks don't apply, so the bubble
 * swaps to the language picker instead — the language tag survives
 * serialization (mdx-editor.ts), so dropping the picker would lose data.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
	const [linkOpen, setLinkOpen] = useState(false);
	const [href, setHref] = useState("");

	const marks = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			code: e.isActive("code"),
			codeBlock: e.isActive("codeBlock"),
			italic: e.isActive("italic"),
			language: (e.getAttributes("codeBlock").language as string) ?? "",
			link: e.isActive("link"),
			linkHref: (e.getAttributes("link").href as string) ?? "",
			strike: e.isActive("strike"),
		}),
	});

	const chain = () => editor.chain().focus();

	function openLinkPopover() {
		setHref(marks.linkHref);
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
		<BubbleMenu
			appendTo={() => document.body}
			className="relative z-50 flex items-center gap-0.5 rounded-md border bg-background/95 p-1.5 backdrop-blur"
			editor={editor}
			options={{
				flip: {},
				offset: 8,
				placement: "top",
				shift: {},
				strategy: "fixed",
			}}
			shouldShow={({ editor: ed, state }) =>
				!state.selection.empty && ed.isEditable
			}
			updateDelay={100}
		>
			{marks.codeBlock ? (
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
					value={marks.language}
				>
					<option value="">plain</option>
					{CODE_LANGUAGES.map((lang) => (
						<option key={lang} value={lang}>
							{lang}
						</option>
					))}
				</Select>
			) : (
				<>
					<ToolButton
						active={marks.bold}
						icon={Bold}
						label="Bold"
						onClick={() => chain().toggleBold().run()}
					/>
					<ToolButton
						active={marks.italic}
						icon={Italic}
						label="Italic"
						onClick={() => chain().toggleItalic().run()}
					/>
					<ToolButton
						active={marks.strike}
						icon={Strikethrough}
						label="Strikethrough"
						onClick={() => chain().toggleStrike().run()}
					/>
					<ToolButton
						active={marks.code}
						icon={Code}
						label="Inline code"
						onClick={() => chain().toggleCode().run()}
					/>
					<ToolbarDivider />
					<ToolButton
						active={marks.link}
						icon={Link2}
						label="Link"
						onClick={openLinkPopover}
					/>
				</>
			)}

			{linkOpen ? (
				<div className="absolute top-full right-2 z-10 mt-1 flex items-center gap-1 rounded-md border bg-background p-1.5">
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
					{marks.link ? (
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
		</BubbleMenu>
	);
}
