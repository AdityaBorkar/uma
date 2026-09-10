import type * as React from "react";

import { cn } from "#/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"relative flex size-8 shrink-0 overflow-hidden rounded-full",
				className,
			)}
			data-slot="avatar"
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: React.ComponentProps<"img">) {
	return (
		<img
			className={cn("aspect-square size-full object-cover", className)}
			data-slot="avatar-image"
			{...props}
		/>
	);
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"bg-muted flex size-full items-center justify-center rounded-full",
				className,
			)}
			data-slot="avatar-fallback"
			{...props}
		/>
	);
}

export { Avatar, AvatarFallback, AvatarImage };
