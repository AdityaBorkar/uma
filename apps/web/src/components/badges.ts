/**
 * Status badge class helpers shared across documents and tasks.
 * Black/white base — color only where visual indication is necessary
 * (success/danger/warning). Text always accompanies color.
 */

/** Open green, closed neutral gray. */
export function stateBadgeClass(state: string): string {
	return state === "open"
		? "border-success-border/30 bg-success-bg text-success-fg"
		: "border-border bg-muted text-muted-foreground";
}

export function taskBadgeClass(status: string): string {
	switch (status) {
		case "running":
			return "border-border bg-muted text-muted-foreground";
		case "completed":
			return "border-success-border/30 bg-success-bg text-success-fg";
		case "failed":
			return "border-danger-fg/30 bg-danger-bg text-danger-fg";
		default:
			return "";
	}
}
