import type { z } from "zod";

export interface ProjectOption {
	id: string;
	name: string;
}

/** Map a Zod error to `{ [firstPathSegment]: message }` for field display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path[0];
		if (typeof key === "string" && out[key] === undefined) {
			out[key] = issue.message;
		}
	}
	return out;
}
