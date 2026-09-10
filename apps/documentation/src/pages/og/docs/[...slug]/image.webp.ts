import type { APIRoute } from "astro";
import { generate as DefaultImage } from "fumadocs-ui/og/takumi";
import { createElement } from "react";
import { ImageResponse } from "takumi-js/response";

import { source } from "@/lib/source.ts";

export function getStaticPaths() {
	return source.getPages().map((page) => ({
		params: {
			slug: page.slugs.length > 0 ? page.slugs.join("/") : undefined,
		},
	}));
}

export const GET: APIRoute = ({ params }) => {
	const slugs = params.slug?.split("/").filter((item) => item.length > 0) ?? [];
	const page = source.getPage(slugs);

	if (!page) return new Response(undefined, { status: 404 });

	return new ImageResponse(
		createElement(DefaultImage, {
			description: page.data.description,
			site: "Astro",
			title: page.data.title,
		}),
		{
			format: "webp",
			height: 630,
			width: 1200,
		},
	);
};
