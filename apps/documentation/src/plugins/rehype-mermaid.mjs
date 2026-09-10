/**
 * rehype plugin: turn ```mermaid fenced blocks into static diagram mounts.
 *
 * Must run BEFORE fumadocs' `rehypeCode` (registered first in
 * `astro.config.mjs`): at this stage a fenced block is still a plain
 * `<pre><code class="language-mermaid">` element. We swap it for a
 * `<div class="mermaid">` mount that `rehypeCode` ignores;
 * `src/scripts/mermaid-client.ts` then renders every `.mermaid` on page.
 */

function extractText(node) {
	if (node.type === "text") return node.value;
	if (Array.isArray(node.children))
		return node.children.map(extractText).join("");
	return "";
}

function visit(node, fn, parent, index) {
	fn(node, parent, index);
	const children = node?.children;
	if (Array.isArray(children)) {
		for (let i = 0; i < children.length; i++) {
			visit(children[i], fn, node, i);
		}
	}
}

function isMermaidCodeBlock(node) {
	if (!node || node.type !== "element" || node.tagName !== "pre") return null;
	const code = node.children?.[0];
	if (!code || code.type !== "element" || code.tagName !== "code") return null;
	const className = code.properties?.className;
	if (!Array.isArray(className) || !className.includes("language-mermaid")) {
		return null;
	}
	return code;
}

export function rehypeMermaid() {
	return (tree) => {
		visit(tree, (node, parent, index) => {
			if (!parent || typeof index !== "number") return;
			const code = isMermaidCodeBlock(node);
			if (!code) return;
			parent.children[index] = {
				type: "element",
				tagName: "figure",
				properties: { className: ["mermaid-figure"] },
				children: [
					{
						type: "element",
						tagName: "div",
						properties: { className: ["mermaid-scroll"] },
						children: [
							{
								type: "element",
								tagName: "div",
								properties: { className: ["mermaid"] },
								children: [{ type: "text", value: extractText(code) }],
							},
						],
					},
				],
			};
		});
	};
}
