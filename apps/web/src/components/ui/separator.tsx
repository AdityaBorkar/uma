import type * as React from "react";

import { cn } from "#/lib/utils.ts";

function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	...props
}: React.ComponentProps<"div"> & {
	orientation?: "horizontal" | "vertical";
	decorative?: boolean;
}) {
	return (
		<div
			aria-orientation={decorative ? undefined : orientation}
			className={cn(
				"bg-border shrink-0",
				orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
				className,
			)}
			data-slot="separator"
			role={decorative ? "none" : "separator"}
			{...props}
		/>
	);
}

export { Separator };
