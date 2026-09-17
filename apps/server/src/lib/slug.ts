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

/** Max slug lengths (single source of truth for procedures + validation). */
export const PROJECT_SLUG_MAX = 60;
export const PROJECT_SLUG_MIN = 2;
export const DOCUMENT_SLUG_MAX = 80;

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
	return slugify(name, "project", PROJECT_SLUG_MAX);
}
