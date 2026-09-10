// @ts-check

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
			rehypePlugins: [rehypeCode],
			remarkPlugins: [
				remarkHeading,
				remarkCodeTab,
				remarkNpm,
				[remarkStructure, { exportAs: "structuredData" }],
			],
			syntaxHighlight: false,
		}),
	},
	outDir: ".output",
	vite: {
		plugins: [tailwindcss()],
	},
});
