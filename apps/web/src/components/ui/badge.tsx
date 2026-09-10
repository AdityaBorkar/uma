import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { badgeVariants } from "#/components/ui/badge-variants";
import { cn } from "#/lib/utils";

function Badge({
	className,
	variant,
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	if (asChild && React.isValidElement(props.children)) {
		const child = props.children as React.ReactElement<{
			className?: string;
		}>;
		return React.cloneElement(child, {
			className: cn(
				badgeVariants({ variant }),
				className,
				(child.props as { className?: string }).className,
			),
		} as React.Attributes & Record<string, unknown>);
	}

	return (
		<span
			className={cn(badgeVariants({ variant }), className)}
			data-slot="badge"
			{...props}
		/>
	);
}

export { Badge };
