import {
	type HTMLMotionProps,
	motion,
	useAnimationControls,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef } from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

function Input({ className, type, ...props }: HTMLMotionProps<"input">) {
	const reduce = useReducedMotion();
	const controls = useAnimationControls();
	const invalid =
		props["aria-invalid"] === true || props["aria-invalid"] === "true";
	const wasInvalid = useRef(invalid);

	// beUI input language (beui.dev/components/motion/input): flagging a
	// field plays a short horizontal shake once, on the transition into the
	// invalid state — never on every render, never under reduced motion.
	useEffect(() => {
		if (invalid && !wasInvalid.current && !reduce) {
			void controls.start({
				transition: { duration: 0.3, ease: EASE_OUT },
				x: [0, -6, 6, -3, 3, 0],
			});
		}
		wasInvalid.current = invalid;
	}, [controls, invalid, reduce]);

	return (
		<motion.input
			animate={controls}
			className={cn(
				"flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
