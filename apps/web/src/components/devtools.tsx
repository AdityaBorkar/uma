import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

export function Devtools() {
	useEffect(() => {
		if (import.meta.env.DEV) {
			// react-doctor-disable-next-line react-hooks-js/todo -- dynamic dev-only imports not optimizable by React Compiler; isolated here to keep __root.tsx compilable
			void import("react-grab");
			// react-doctor-disable-next-line react-hooks-js/todo -- see above
			void import("react-scan");
		}
	}, []);

	return (
		<TanStackDevtools
			config={{ position: "bottom-right" }}
			plugins={[
				{
					name: "Tanstack Router",
					render: <TanStackRouterDevtoolsPanel />,
				},
				{
					name: "Tanstack Query",
					render: <ReactQueryDevtoolsPanel />,
				},
			]}
		/>
	);
}
