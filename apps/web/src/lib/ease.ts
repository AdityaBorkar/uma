// Shared motion tokens. Only tokens with a live caller live here.

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Press feedback on buttons and other tappable surfaces. */
export const SPRING_PRESS = {
	damping: 30,
	mass: 0.6,
	stiffness: 500,
	type: "spring",
} as const;

/** Overlay panel entrances — modals and sheets summoned by pointer. */
export const SPRING_PANEL = {
	damping: 40,
	mass: 0.5,
	stiffness: 420,
	type: "spring",
} as const;

/** Shared-layout glides — pills, indicators and panels morphing between positions. */
export const SPRING_LAYOUT = {
	damping: 32,
	mass: 0.6,
	stiffness: 360,
	type: "spring",
} as const;
