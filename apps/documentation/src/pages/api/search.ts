import type { APIRoute } from "astro";
import { createFromSource } from "fumadocs-core/search/server";

import { getStructuredData, source } from "@/source";

const server = createFromSource(source, {
	buildIndex(page) {
		const { url } = page;
		const { description = "", title, _raw } = page.data;
		const structuredData = getStructuredData(_raw);
		return { description, id: _raw.id, structuredData, title, url };
	},
});

export const GET: APIRoute = () => {
	return server.staticGET();
};
