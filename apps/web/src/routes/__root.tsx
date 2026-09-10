import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";

import { ToastProvider } from "#/components/ui/toaster.tsx";
import { Devtools } from "../components/devtools.tsx";
import PostHogProvider from "../components/provider.tsx";
// biome-ignore lint/correctness/noUnresolvedImports: the css import is resolved at build time
import css from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		links: [{ href: css, rel: "stylesheet" }],
		meta: [
			{ charSet: "utf-8" },
			{ content: "width=device-width, initial-scale=1", name: "viewport" },
			{ content: "light dark", name: "color-scheme" },
			{ title: "Planner" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="dark">
				<PostHogProvider>
					<ToastProvider>{children}</ToastProvider>
				</PostHogProvider>
				<Devtools />
				<Scripts />
			</body>
		</html>
	);
}
