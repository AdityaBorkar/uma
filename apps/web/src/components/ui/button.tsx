import type { VariantProps } from "class-variance-authority";
import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { buttonVariants } from "#/components/ui/button-variants.ts";
import { SPRING_PRESS } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: HTMLMotionProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const reduce = useReducedMotion();
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
		// beUI press feedback (beui.dev/components/motion/button): a small
		// scale dip on a fast weighted spring; hover stays a CSS color change.
		<motion.button
			className={cn(buttonVariants({ className, size, variant }))}
			data-slot="button"
			transition={SPRING_PRESS}
			// exactOptionalPropertyTypes: absent prop instead of `whileTap={undefined}`.
			{...(reduce ? {} : { whileTap: { scale: 0.97 } })}
			{...props}
		/>
	);
}

export { Button };
