/**
 * Server-only MDX pipeline for Documents (ADR 004).
 *
 * The stored body is complete MDX source (frontmatter included). Rendering
 * strips frontmatter, compiles MDX behind a strict safety allowlist — no
 * imports/exports, no JS expressions, no JSX components — and renders to a
 * static HTML string. The client never sees compiler output or unsanitized
 * markup; malformed content raises a recoverable `MdxRenderError`, never a 500.
 */
import { evaluate } from "@mdx-js/mdx";
import matter from "gray-matter";
import type { ComponentType } from "react";
// biome-ignore lint/correctness/noUnresolvedImports: False positive
import { createElement, Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import remarkGfm from "remark-gfm";

export class MdxRenderError extends Error {}

interface MdxContentProps {
	components?: Record<string, ComponentType<Record<string, unknown>>>;
}

interface MdastNode {
	children?: MdastNode[];
	name?: string;
	type: string;
}

/** Reject ESM (import/export) and raw JS expressions outright (ADR 004). */
function assertSafe(tree: MdastNode): void {
	for (const node of tree.children ?? []) {
		if (node.type === "mdxjsEsm") {
			throw new MdxRenderError(
				"Imports and exports are not allowed in document bodies",
			);
		}
		if (
			node.type === "mdxFlowExpression" ||
			node.type === "mdxTextExpression"
		) {
			throw new MdxRenderError(
				"JavaScript expressions are not allowed in document bodies",
			);
		}
		// Uppercase JSX resolves to an undefined component by design; reject it
		// up front with a readable message instead of an eval failure.
		if (
			(node.type === "mdxJsxFlowElement" ||
				node.type === "mdxJsxTextElement") &&
			node.name &&
			/^[A-Z]/.exec(node.name)
		) {
			throw new MdxRenderError(
				`Custom component <${node.name}> is not allowed in document bodies`,
			);
		}
		assertSafe(node);
	}
}

/** Remark plugin enforcing the safety allowlist at parse time. */
function unsafeNodeRejection() {
	return (tree: MdastNode) => {
		assertSafe(tree);
	};
}

/** `#42`-style references resolve to sibling documents (SOW Phase D2). */
function Anchor(props: Record<string, unknown>) {
	const href = typeof props.href === "string" ? props.href : "";
	const match = /^#(\d+)$/.exec(href);
	// Server render has no project scope; `~` (multi-project) resolves any
	// owned document number, so it is the only scope-safe canonical target.
	return createElement("a", {
		...props,
		href: match ? `/~/documents/${match[1]}` : href,
	});
}

/** Strip the frontmatter block, returning YAML data + MDX-only content. */
export function splitFrontmatter(body: string): {
	content: string;
	data: Record<string, unknown>;
} {
	try {
		const parsed = matter(body);
		return { content: parsed.content, data: parsed.data };
	} catch {
		throw new MdxRenderError("Frontmatter block is malformed YAML");
	}
}

/**
 * Compile + render a document body to an HTML fragment. Throws
 * `MdxRenderError` for anything outside the allowlist — callers must catch
 * it and show a recoverable message (SOW acceptance D1).
 */
export async function renderBody(body: string): Promise<string> {
	const { content } = splitFrontmatter(body);
	try {
		const { default: MDXContent } = await evaluate(content, {
			development: false,
			Fragment,
			jsx,
			jsxs,
			remarkPlugins: [remarkGfm, unsafeNodeRejection],
		});
		return renderToStaticMarkup(
			createElement(MDXContent as ComponentType<MdxContentProps>, {
				components: { a: Anchor },
			}),
		);
	} catch (error) {
		if (error instanceof MdxRenderError) {
			throw error;
		}
		throw new MdxRenderError(
			error instanceof Error ? error.message : String(error),
		);
	}
}
