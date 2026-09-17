"use client";
// beui.dev/components/motion/button

import { Check, Loader2, X } from "lucide-react";
import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import {
	forwardRef,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { EASE_OUT, SPRING_SWAP } from "#/lib/ease.ts";
import { Button, type ButtonProps } from "./base.tsx";

export type ButtonState = "idle" | "loading" | "success" | "error";

export interface StatefulButtonProps extends Omit<ButtonProps, "children"> {
	children: ReactNode;
	errorText?: ReactNode;
	icon?: ReactNode;
	loadingText?: ReactNode;
	state?: ButtonState;
	successText?: ReactNode;
}

const CASCADE_STAGGER = 0.025;
const ROLL_BLUR = "blur(6px)";

const CASCADE_LETTER_VARIANTS: Variants = {
	animate: (delay: number = 0) => ({
		filter: "blur(0px)",
		opacity: 1,
		transition: { ...SPRING_SWAP, delay },
		y: "0%",
	}),
	exit: (delay: number = 0) => ({
		filter: ROLL_BLUR,
		opacity: 0,
		transition: { delay: delay * 0.5, duration: 0.16, ease: EASE_OUT },
		y: "-105%",
	}),
	initial: { filter: ROLL_BLUR, opacity: 0, y: "105%" },
};

const ICON_VARIANTS: Variants = {
	animate: {
		filter: "blur(0px)",
		opacity: 1,
		scale: 1,
		transition: SPRING_SWAP,
		width: "1.5rem",
	},
	exit: {
		filter: ROLL_BLUR,
		opacity: 0,
		scale: 0.7,
		transition: { duration: 0.16, ease: EASE_OUT },
		width: 0,
	},
	// Width collapses too, so the icon adds/removes its own space smoothly
	// instead of popping the row width in a single frame.
	initial: { filter: ROLL_BLUR, opacity: 0, scale: 0.7, width: 0 },
};

function IconSlot({ keyId, children }: { keyId: string; children: ReactNode }) {
	const reduce = useReducedMotion();
	return (
		<motion.span
			animate={reduce ? { opacity: 1 } : "animate"}
			exit={reduce ? { opacity: 0 } : "exit"}
			initial={reduce ? { opacity: 0 } : "initial"}
			key={keyId}
			variants={ICON_VARIANTS}
			// exactOptionalPropertyTypes: absent prop instead of `transition={undefined}`.
			{...(reduce ? { transition: { duration: 0.15 } } : {})}
			className="inline-grid shrink-0 place-items-center overflow-hidden"
		>
			{children}
		</motion.span>
	);
}

function TextSlot({ value, children }: { value: string; children: ReactNode }) {
	const reduce = useReducedMotion();
	const measureRef = useRef<HTMLSpanElement>(null);
	const [width, setWidth] = useState<number>();
	const label = typeof children === "string" ? children : null;
	const cascade = label !== null && !reduce;

	// Measure strings with the same per-letter layout as the cascade. Measuring
	// the whole string preserves kerning, which can make it narrower than the
	// inline-block letters and clip the final glyph during the width animation.
	useLayoutEffect(() => {
		const nextWidth = measureRef.current?.offsetWidth;
		if (!nextWidth) return;
		setWidth((current) => (current === nextWidth ? current : nextWidth));
	});

	return (
		<motion.span
			// exactOptionalPropertyTypes: `{}` animates nothing, like `{ width: undefined }`.
			animate={width === undefined ? {} : { width }}
			className="relative inline-block overflow-hidden whitespace-nowrap align-bottom"
			initial={false}
			transition={reduce ? { duration: 0 } : SPRING_SWAP}
		>
			<span
				aria-hidden
				className="invisible inline-block whitespace-nowrap"
				ref={measureRef}
			>
				{cascade
					? label.split("").map((char, index) => (
							<span
								className="inline-block whitespace-pre"
								// biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity.
								key={index}
							>
								{char}
							</span>
						))
					: children}
			</span>

			{cascade ? (
				<>
					<span className="sr-only">{label}</span>
					<AnimatePresence initial={false}>
						<motion.span
							animate="animate"
							aria-hidden
							className="absolute left-0 top-0 inline-block whitespace-pre"
							exit="exit"
							initial="initial"
							key={`cascade-${value}`}
						>
							{label.split("").map((char, index) => (
								<motion.span
									className="inline-block whitespace-pre will-change-[opacity,filter,transform]"
									custom={index * CASCADE_STAGGER}
									// biome-ignore lint/suspicious/noArrayIndexKey: position is the slot identity.
									key={index}
									variants={CASCADE_LETTER_VARIANTS}
								>
									{char}
								</motion.span>
							))}
						</motion.span>
					</AnimatePresence>
				</>
			) : (
				<AnimatePresence initial={false}>
					<motion.span
						animate={
							reduce
								? { opacity: 1 }
								: { filter: "blur(0px)", opacity: 1, y: 0 }
						}
						className="absolute left-0 top-0 inline-block will-change-[opacity,filter,transform]"
						exit={
							reduce
								? { opacity: 0 }
								: { filter: ROLL_BLUR, opacity: 0, y: -14 }
						}
						initial={
							reduce ? { opacity: 0 } : { filter: ROLL_BLUR, opacity: 0, y: 14 }
						}
						key={`text-${value}`}
						transition={reduce ? { duration: 0.15 } : SPRING_SWAP}
					>
						{children}
					</motion.span>
				</AnimatePresence>
			)}
		</motion.span>
	);
}

export const StatefulButton = forwardRef<
	HTMLButtonElement,
	StatefulButtonProps
>(function StatefulButton(
	{
		state = "idle",
		children,
		loadingText = "Loading",
		successText = "Done",
		errorText = "Try again",
		icon,
		disabled,
		...rest
	},
	ref,
) {
	const isBusy = state === "loading";
	const stateText =
		state === "loading"
			? loadingText
			: state === "success"
				? successText
				: state === "error"
					? errorText
					: children;
	const textKey =
		typeof stateText === "string" ? `${state}-${stateText}` : state;

	return (
		// exactOptionalPropertyTypes: `whileHover={{ scale: 1 }}` is a visual
		// no-op that keeps the original `whileHover={undefined}` intent (no lift).
		<Button
			aria-busy={isBusy}
			disabled={disabled || isBusy}
			ref={ref}
			whileHover={{ scale: 1 }}
			{...rest}
		>
			<span
				aria-live="polite"
				className="relative inline-flex items-center justify-center overflow-hidden"
			>
				<AnimatePresence initial={false}>
					{state === "loading" ? (
						<IconSlot keyId="loading-icon">
							<Loader2 className="h-4 w-4 animate-spin" />
						</IconSlot>
					) : null}
					{state === "success" ? (
						<IconSlot keyId="success-icon">
							<Check className="h-4 w-4" />
						</IconSlot>
					) : null}
					{state === "error" ? (
						<IconSlot keyId="error-icon">
							<X className="h-4 w-4" />
						</IconSlot>
					) : null}
				</AnimatePresence>

				<TextSlot value={textKey}>{stateText}</TextSlot>

				<AnimatePresence initial={false}>
					{state === "idle" && icon ? (
						<IconSlot keyId="idle-icon">{icon}</IconSlot>
					) : null}
				</AnimatePresence>
			</span>
		</Button>
	);
});
