/**
 * Shared slug helpers — used by project + document procedures
 * (`src/rpc/scope.ts`) and routes.
 */

export const RESERVED_PROJECT_SLUGS = new Set([
	"~",
	"api",
	"login",
	"settings",
]);

export function isReservedProjectSlug(slug: string): boolean {
	return RESERVED_PROJECT_SLUGS.has(slug.toLowerCase());
}

/**
 * Slugify any freeform title/name into a url-safe slug.
 * @param input - display name/title
 * @param fallback - used when slugify would be empty (e.g. "!!!" -> fallback)
 * @param maxLen - trim length
 */
export function slugify(
	input: string,
	fallback = "project",
	maxLen = 60,
): string {
	const base = input
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, maxLen)
		.replaceAll(/-+$/g, "");
	return base || fallback;
}

/** Project-specific slugify: max 60 chars, fallback `project`. */
export function slugifyProject(name: string): string {
	return slugify(name, "project", 60);
}
