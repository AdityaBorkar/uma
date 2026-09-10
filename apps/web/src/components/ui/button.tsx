import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { buttonVariants } from "#/components/ui/button-variants";
import { cn } from "#/lib/utils";

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	if (asChild && React.isValidElement(props.children)) {
		const child = props.children as React.ReactElement<{
			className?: string;
		}>;
		return React.cloneElement(child, {
			className: cn(
				buttonVariants({ className, size, variant }),
				(child.props as { className?: string }).className,
			),
			...(props as unknown as Record<string, unknown>),
		} as React.Attributes & Record<string, unknown>);
	}

	return (
		<button
			className={cn(buttonVariants({ className, size, variant }))}
			data-slot="button"
			{...props}
		/>
	);
}

export { Button };
