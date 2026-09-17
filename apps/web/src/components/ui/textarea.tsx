import {
	type HTMLMotionProps,
	motion,
	useAnimationControls,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef } from "react";

import { EASE_OUT } from "#/lib/ease.ts";
import { cn } from "#/lib/utils.ts";

function Textarea({ className, ...props }: HTMLMotionProps<"textarea">) {
	const reduce = useReducedMotion();
	const controls = useAnimationControls();
	const invalid =
		props["aria-invalid"] === true || props["aria-invalid"] === "true";
	const wasInvalid = useRef(invalid);

	// Same invalid-transition shake as Input (beUI input language).
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
		<motion.textarea
			animate={controls}
			className={cn(
				"flex min-h-15 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			data-slot="textarea"
			{...props}
		/>
	);
}

export { Textarea };
