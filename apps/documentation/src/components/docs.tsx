import { navigate } from "astro:transitions/client";

import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsPage, type DocsPageProps } from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";

import SearchDialog from "./search.tsx";

export function Docs({
	tree,
	children,
	pathname,
	params,
	page,
}: {
	tree: Root;
	children: ReactNode;
	pathname: string;
	params: AstroProviderProps["params"];
	page?: DocsPageProps;
}) {
	return (
		<RootProvider
			navigate={navigate}
			params={params}
			pathname={pathname}
			search={{ SearchDialog }}
			theme={{ enabled: false }}
		>
			<DocsLayout
				nav={{
					title: "Fumadocs on Astro",
				}}
				themeSwitch={{
					enabled: false,
				}}
				tree={tree}
			>
				<DocsPage {...page}>{children}</DocsPage>
			</DocsLayout>
		</RootProvider>
	);
}
