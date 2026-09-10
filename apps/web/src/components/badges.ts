/**
 * Status/severity badge class helpers shared across documents, signals, and
 * tasks. Text always accompanies color — color is never the sole signal.
 */

/** Primer StateLabel subtle: open green, closed purple. */
export function stateBadgeClass(state: string): string {
	return state === "open"
		? "border-[#1a7f37]/30 bg-[#dafbe1] text-[#1a7f37] dark:border-[#2ea043]/30 dark:bg-[#12261e] dark:text-[#3fb950]"
		: "border-[#8250df]/20 bg-[#fbefff] text-[#8250df] dark:border-[#8957e5]/30 dark:bg-[#1e1626] dark:text-[#bc8cff]";
}

export function severityBadgeClass(severity: string): string {
	switch (severity) {
		case "critical":
			return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
		case "warning":
			return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
		default:
			return "";
	}
}

export function taskBadgeClass(status: string): string {
	switch (status) {
		case "running":
			return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
		case "completed":
			return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
		case "failed":
			return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
		default:
			return "";
	}
}
