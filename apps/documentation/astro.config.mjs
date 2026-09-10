// @ts-check

import { fileURLToPath } from "node:url";

import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import {
	rehypeCode,
	remarkCodeTab,
	remarkHeading,
	remarkNpm,
	remarkStructure,
} from "fumadocs-core/mdx-plugins";

import { rehypeMermaid } from "./src/plugins/mermaid/rehype-mermaid.mjs";

export default defineConfig({
	integrations: [
		react(),
		mdx({
			extendMarkdownConfig: true,
			syntaxHighlight: false,
		}),
	],
	markdown: {
		processor: unified({
			rehypePlugins: [rehypeMermaid, rehypeCode],
			remarkPlugins: [
				remarkHeading,
				remarkCodeTab,
				remarkNpm,
				[remarkStructure, { exportAs: "structuredData" }],
			],
		}),
	},
	outDir: ".output",
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: [
				{
					find: /^@\//,
					replacement: fileURLToPath(new URL("./src/", import.meta.url)),
				},
			],
		},
	},
});
