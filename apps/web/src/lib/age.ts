// Wall-clock age/duration formatting for signals and tasks (dashboard,
// signals, tasks pages). Deliberately coarse — these are glanceable labels,
// not measurements.

/** "just now" | "3m" | "2h" | "4d" | "3w" since `from` until now (or `to`). */
export function formatAge(from: Date | string, to?: Date | string): string {
	const start = new Date(from).getTime();
	const end = to ? new Date(to).getTime() : Date.now();
	if (Number.isNaN(start) || Number.isNaN(end)) {
		return "—";
	}
	const seconds = Math.max(0, Math.floor((end - start) / 1000));
	if (seconds < 60) {
		return "just now";
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h`;
	}
	const days = Math.floor(hours / 24);
	if (days < 14) {
		return `${days}d`;
	}
	const weeks = Math.floor(days / 7);
	return `${weeks}w`;
}

/** "3m ago" style label for list rows. */
export function formatAgo(from: Date | string): string {
	const age = formatAge(from);
	return age === "just now" ? age : `${age} ago`;
}

/** Human duration between two stamps, e.g. "4m", "2h 15m", "3d 4h". */
export function formatDuration(from: Date | string, to: Date | string): string {
	const start = new Date(from).getTime();
	const end = new Date(to).getTime();
	if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
		return "—";
	}
	const minutes = Math.floor((end - start) / 60_000);
	if (minutes < 60) {
		return `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	if (hours < 24) {
		return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
	}
	const days = Math.floor(hours / 24);
	const remHours = hours % 24;
	return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
