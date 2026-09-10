import { relative } from "node:path";
import { type CollectionEntry, getCollection } from "astro:content";

import { type StructuredData, structure } from "fumadocs-core/mdx-plugins";
import type { StaticSource } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";

export const source = loader({
	baseUrl: "/",
	source: await createSource(),
});

export function getStructuredData(
	entry: CollectionEntry<"docs">,
): StructuredData {
	return structure(entry.body || "");
}

export function getPageImageUrl(page: (typeof source)["$inferPage"]) {
	return ["/", page.locale, "og", "docs", ...page.slugs, "image.webp"]
		.filter(Boolean)
		.join("/");
}

async function createSource() {
	const out: StaticSource<{
		metaData: CollectionEntry<"meta">["data"];
		pageData: CollectionEntry<"docs">["data"] & {
			_raw: CollectionEntry<"docs">;
		};
	}> = {
		files: [],
	};

	for (const page of await getCollection("docs")) {
		const data = { ...page.data, _raw: page };
		const path = relative("content/docs", page.filePath || "");
		out.files.push({ data, path, type: "page" });
	}

	for (const { data, filePath } of await getCollection("meta")) {
		const path = relative("content/docs", filePath || "");
		out.files.push({ data, path, type: "meta" });
	}

	return out;
}
