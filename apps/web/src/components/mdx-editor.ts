/**
 * Bidirectional serialization between the Tiptap editor and MDX source
 * (docs/adr/004-documents-single-primitive.md §6).
 *
 * Save: editor HTML → hast → mdast → content-only markdown (valid MDX).
 * Load: MDX source → frontmatter stripped → mdast → sanitized hast → HTML.
 *
 * Isomorphic by design — this runs client-side on every save, so unlike
 * `mdx.server.ts` it must not touch Node-only modules (gray-matter pulls
 * `fs`; frontmatter stripping here is a bounded regex instead).
 *
 * The node/mark allowlist mirrors what `src/lib/mdx.server.ts` renders.
 * The server-side render allowlist stays the final gate — this module adds
 * convenience, never security.
 */
import { defaultSchema, type Schema } from "hast-util-sanitize";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/** Raised when editor content cannot be represented as safe MDX. */
export class MdxSerializeError extends Error {}

/**
 * Sanitize schema for the load direction: GitHub-flavored basics plus what
 * the allowlisted node set legitimately emits — code-fence language tags,
 * GFM table alignment, and task-list checkboxes. Everything else (styles,
 * event handlers, unknown elements) is dropped before the editor sees it,
 * which is also the paste-hardening story (SOW §3/E3).
 */
const EDITOR_SCHEMA: Schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		code: [["className", /^language-./]],
		input: ["checked", "disabled", "type"],
		td: [["align"]],
		th: [["align"]],
	},
};

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/** Split a leading frontmatter block without pulling YAML libs client-side. */
export function splitFrontmatter(source: string): {
	content: string;
	hasFrontmatter: boolean;
} {
	const match = FRONTMATTER_RE.exec(source);
	if (!match) {
		return { content: source, hasFrontmatter: false };
	}
	return { content: source.slice(match[0].length), hasFrontmatter: true };
}

/**
 * Editor HTML → content-only MDX source. Lossless within the allowlisted
 * node set; anything outside it cannot have been authored in the editor.
 */
export function htmlToMdx(html: string): string {
	let out: string;
	try {
		out = unified()
			.use(rehypeParse, { fragment: true })
			.use(rehypeRemark)
			.use(remarkGfm)
			.use(remarkStringify, {
				bullet: "-",
				emphasis: "*",
				fence: "`",
				rule: "-",
			})
			.processSync(html)
			.toString();
	} catch (error) {
		throw new MdxSerializeError(
			error instanceof Error ? error.message : String(error),
		);
	}
	// Empty documents serialize as "" so the form's required-body check fires.
	return out.trim();
}

/**
 * MDX source → sanitized HTML for `editor.commands.setContent`. Throws on
 * content outside the load allowlist (e.g. JSX components); callers catch
 * and fall back to the raw-source textarea (SOW E2 acceptance).
 */
export function mdxToHtml(source: string): string {
	const { content } = splitFrontmatter(source);
	let out: string;
	try {
		out = unified()
			.use(remarkParse)
			// remark-mdx parses legacy JSX-bearing bodies so they fail loudly
			// downstream (typed fallback) instead of leaking markup as text.
			.use(remarkMdx)
			.use(remarkGfm)
			.use(remarkRehype)
			.use(rehypeSanitize, EDITOR_SCHEMA)
			.use(rehypeStringify)
			.processSync(content)
			.toString();
	} catch (error) {
		throw new MdxSerializeError(
			error instanceof Error ? error.message : String(error),
		);
	}
	return out.trim();
}
