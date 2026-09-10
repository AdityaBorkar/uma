import type * as React from "react";

import { cn } from "#/lib/utils";

function Select({
	className,
	children,
	...props
}: React.ComponentProps<"select">) {
	return (
		<select
			className={cn(
				"flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			data-slot="select"
			{...props}
		>
			{children}
		</select>
	);
}

export { Select };
