/**
 * Round-trip stability check for the document editor serialization
 * (docs/adr/004-documents-single-primitive.md §10).
 *
 * For every fixture: MDX → HTML → MDX must be byte-stable modulo
 * whitespace. Run with:
 *
 *   bunx tsx scripts/mdx-editor.roundtrip.ts
 */

import { htmlToMdx, mdxToHtml } from "#/components/mdx-editor.ts";

const FIXTURES: [string, string][] = [
	[
		"headings + emphasis",
		`## Summary

Some **bold**, *italic*, ~~struck~~, and \`inline code\`.

### Sub-head

#### Deep head
`,
	],
	[
		"lists",
		`- one
- two

1. first
2. second
`,
	],
	[
		"task list",
		`- [ ] open item
- [x] done item
`,
	],
	[
		"blockquote + rule",
		`> A quoted decision.

---

After the rule.
`,
	],
	[
		"code fence",
		`\`\`\`ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`
`,
	],
	[
		"table",
		`| Area | Status | Notes |
| --- | --- | --- |
| auth | done | uses sessions |
| sync | open | blocked on D4 |
`,
	],
	[
		"links + document references",
		`See [#1](#1) and [the docs](https://example.com/guide).
`,
	],
];

/** Normalize whitespace that is allowed to differ between passes. */
function normalize(source: string): string {
	return source
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""))
		.join("\n")
		.replace(/\n{2,}$/g, "\n");
}

let failures = 0;

for (const [_name, source] of FIXTURES) {
	try {
		const once = htmlToMdx(mdxToHtml(source));
		const twice = htmlToMdx(mdxToHtml(once));
		if (normalize(once) !== normalize(twice)) {
			failures++;
			continue;
		}
		if (!mdxToHtml(once).trim()) {
			failures++;
		}
	} catch {
		failures++;
	}
}

// Frontmatter must never enter the editor pipeline output.
const legacy = `---
title: Legacy
kind: wiki
---

## Body only

No YAML in the editor.
`;
const stripped = htmlToMdx(mdxToHtml(legacy));
if (stripped.includes("Legacy") || stripped.includes("---")) {
	failures++;
} else {
}

if (failures > 0) {
	process.exit(1);
}
