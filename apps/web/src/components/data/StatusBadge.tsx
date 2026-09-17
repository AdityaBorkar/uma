import { stateBadgeClass, taskBadgeClass } from "#/components/badges.ts";
import { Badge } from "#/components/ui/badge.tsx";

/**
 * Generic status → Badge variant mapper. Replaces the 5-line
 * `statusVariant` clones in agents.tsx (available/deprecated) and
 * machines.tsx (connected/revoked).
 */
export function statusVariant(
	status: string,
	opts: { danger: string[]; success: string[] },
): "success" | "outline" | "destructive" {
	if (opts.success.includes(status)) {
		return "success";
	}
	if (opts.danger.includes(status)) {
		return "destructive";
	}
	return "outline";
}

/** Document state badge (open green subtle / closed purple). */
export function DocStateBadge({ state }: { state: string }) {
	return (
		<Badge className={stateBadgeClass(state)} variant="outline">
			{state}
		</Badge>
	);
}

/** Task status badge. Guide-compliant: outline + helper class. */
export function TaskStatusBadge({
	status,
}: {
	status: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
	return (
		<Badge className={taskBadgeClass(status)} variant="outline">
			{status}
		</Badge>
	);
}

/** Generic registry status badge (agents, machines, …). */
export function RegistryStatusBadge({
	danger,
	status,
	success,
}: {
	danger: string[];
	status: string;
	success: string[];
}) {
	return (
		<Badge variant={statusVariant(status, { danger, success })}>{status}</Badge>
	);
}
