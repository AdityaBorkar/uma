import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";

import {
	Heading2,
	Heading3,
	Heading4,
	type IconComponent,
	List,
	ListOrdered,
	ListTodo,
	Minus,
	Quote,
	SquareCode,
	TableIcon,
} from "#/components/icons.tsx";
import { cn } from "#/lib/utils.ts";

interface SlashRange {
	from: number;
	to: number;
}

interface SlashSnapshot extends SlashRange {
	query: string;
}

interface SlashItem {
	hint: string;
	icon: IconComponent;
	keywords: string;
	run: (editor: Editor, range: SlashRange) => void;
	title: string;
}

const SLASH_ITEMS: SlashItem[] = [
	{
		hint: "Large section heading",
		icon: Heading2,
		keywords: "h2 title header section",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run();
		},
		title: "Heading 2",
	},
	{
		hint: "Medium section heading",
		icon: Heading3,
		keywords: "h3 title header subsection",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run();
		},
		title: "Heading 3",
	},
	{
		hint: "Small section heading",
		icon: Heading4,
		keywords: "h4 title header",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).setHeading({ level: 4 }).run();
		},
		title: "Heading 4",
	},
	{
		hint: "Bulleted list",
		icon: List,
		keywords: "ul unordered bullet points",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).toggleBulletList().run();
		},
		title: "Bullet list",
	},
	{
		hint: "Numbered list",
		icon: ListOrdered,
		keywords: "ol ordered numbered steps",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).toggleOrderedList().run();
		},
		title: "Numbered list",
	},
	{
		hint: "Checkable task list",
		icon: ListTodo,
		keywords: "todo checkbox tasks",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).toggleTaskList().run();
		},
		title: "Task list",
	},
	{
		hint: "Block quotation",
		icon: Quote,
		keywords: "quote cite callout",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).toggleBlockquote().run();
		},
		title: "Quote",
	},
	{
		hint: "Fenced code block",
		icon: SquareCode,
		keywords: "code pre snippet fence",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).toggleCodeBlock().run();
		},
		title: "Code block",
	},
	{
		hint: "3×3 table with header row",
		icon: TableIcon,
		keywords: "table grid columns rows",
		run: (e, r) => {
			e.chain()
				.focus()
				.deleteRange(r)
				.insertTable({ cols: 3, rows: 3, withHeaderRow: true })
				.run();
		},
		title: "Table",
	},
	{
		hint: "Horizontal rule",
		icon: Minus,
		keywords: "hr divider line separator rule",
		run: (e, r) => {
			e.chain().focus().deleteRange(r).setHorizontalRule().run();
		},
		title: "Divider",
	},
];

/**
 * Read a pending "/query" before a collapsed cursor. Triggers at the start
 * of a text block or after whitespace; never inside code blocks, where "/"
 * is literal text.
 */
function readSlash(e: Editor): SlashSnapshot | null {
	const { selection } = e.state;
	if (!selection.empty) {
		return null;
	}
	const $from = selection.$from;
	const parent = $from.parent;
	if (!parent.isTextblock || parent.type.name === "codeBlock") {
		return null;
	}
	const textBefore = parent.textBetween(0, $from.parentOffset, undefined, "�");
	const match = /(?:^|\s)\/([\w-]*)$/.exec(textBefore);
	if (!match) {
		return null;
	}
	const slashOffset = match.index + (match[0].startsWith("/") ? 0 : 1);
	return {
		from: $from.start() + slashOffset,
		query: match[1] ?? "",
		to: $from.pos,
	};
}

/**
 * Inline "/command" menu for block-level inserts. Opens while a "/query"
 * precedes a collapsed cursor; typing filters, ↑↓/Enter/Escape navigate,
 * confirm, and dismiss. Choosing an item deletes the "/query" range first.
 */
export function SlashMenu({ editor }: { editor: Editor }) {
	const slash = useEditorState({
		editor,
		selector: ({ editor: e }) => readSlash(e),
	});
	const [active, setActive] = useState(0);
	const [dismissedFrom, setDismissedFrom] = useState<number | null>(null);

	const visible = slash && slash.from !== dismissedFrom ? slash : null;

	useEffect(() => {
		setDismissedFrom(null);
		setActive(0);
	}, [slash?.from, slash?.query, slash?.to]);

	const items = useMemo(() => {
		if (!visible) {
			return [];
		}
		const q = visible.query.toLowerCase();
		if (!q) {
			return SLASH_ITEMS;
		}
		return SLASH_ITEMS.filter((item) =>
			`${item.title} ${item.keywords}`.toLowerCase().includes(q),
		);
	}, [visible]);

	const safeActive =
		items.length === 0 ? 0 : Math.min(active, items.length - 1);

	function runItem(item: SlashItem) {
		if (!visible) {
			return;
		}
		item.run(editor, { from: visible.from, to: visible.to });
		setActive(0);
	}

	useEffect(() => {
		if (!visible || items.length === 0) {
			return;
		}
		const target = visible;
		function onKeyDown(e: KeyboardEvent) {
			if (!editor.view.dom.contains(document.activeElement)) {
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				e.stopPropagation();
				setActive((a) => (a + 1) % items.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				e.stopPropagation();
				setActive((a) => (a - 1 + items.length) % items.length);
			} else if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				const item = items[safeActive];
				if (item) {
					runItem(item);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				setDismissedFrom(target.from);
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	});

	if (!visible || typeof window === "undefined") {
		return null;
	}

	const coords = editor.view.coordsAtPos(visible.to);
	const estimatedHeight = Math.min(items.length, 7) * 44 + 12;
	const openUp = coords.bottom + estimatedHeight + 8 > window.innerHeight;

	return (
		<div
			aria-label="Block commands"
			className="fixed z-50 w-64 rounded-md border bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/80"
			role="listbox"
			style={{
				left: Math.max(8, Math.min(coords.left, window.innerWidth - 272)),
				top: openUp
					? Math.max(8, coords.top - estimatedHeight - 8)
					: coords.bottom + 6,
			}}
		>
			{items.length === 0 ? (
				<p className="px-2.5 py-2 text-muted-foreground text-xs">
					No matches for “/{visible.query}”
				</p>
			) : (
				<ul>
					{items.map((item, i) => (
						<li key={item.title}>
							<button
								aria-selected={i === safeActive}
								className={cn(
									"flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
									i === safeActive && "bg-accent text-accent-foreground",
								)}
								onClick={() => runItem(item)}
								onMouseDown={(e) => e.preventDefault()}
								onMouseMove={() => setActive(i)}
								role="option"
								type="button"
							>
								<item.icon className="size-4 shrink-0" />
								<span className="min-w-0">
									<span className="block text-[13px] font-medium leading-tight">
										{item.title}
									</span>
									<span className="block truncate text-muted-foreground text-xs leading-tight">
										{item.hint}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
