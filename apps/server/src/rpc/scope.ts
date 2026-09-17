import { ORPCError } from "@orpc/server";
import { type AnyColumn, and, eq, lt, or } from "drizzle-orm";

import { type DbTx, db } from "../db/client.ts";
import { documents } from "../db/documents.ts";
import { projects } from "../db/projects.ts";
import {
	DOCUMENT_SLUG_MAX,
	PROJECT_SLUG_MAX,
	slugify,
	slugifyProject,
} from "../lib/slug.ts";

export type { DbTx };

/** Shared ownership + slug + keyset-pagination helpers for all oRPC procedures. */

export async function assertProjectOwned(projectId: string, userId: string) {
	const [row] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.createdBy, userId)))
		.limit(1);
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
}

/**
 * Require a single row owned by `userId` (by `id` + owner column).
 * Throws NOT_FOUND when missing or owned by someone else, so callers never
 * branch on ownership themselves.
 */
export function throwNotFound<T>(
	row: T | undefined,
	message = "Not found",
): asserts row is T {
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message });
	}
}

/** Throw NOT_FOUND unless the mutation returned a row (guarded-write miss). */
export function mustReturn<T>(row: T | undefined, message = "Not found"): T {
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message });
	}
	return row;
}

/** Zero-fill `groupBy(status)` rows so every known status has a count. */
export function zeroFilledCounts(
	rows: { count: number; status: string }[],
	keys: readonly string[],
): Record<string, number> {
	const byStatus = new Map(rows.map((r) => [r.status, r.count]));
	return Object.fromEntries(keys.map((k) => [k, byStatus.get(k) ?? 0]));
}

/** Map a Postgres unique-violation to CONFLICT instead of a raw 500. */
export function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const code = (error as { code?: unknown }).code;
	if (code === "23505") return true;
	const message = error instanceof Error ? error.message : String(error);
	return /duplicate key|unique constraint|UNIQUE constraint/i.test(message);
}

export function toConflict(message: string) {
	return new ORPCError("CONFLICT", { message });
}

async function firstAvailableSlug(
	base: string,
	isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
	for (let n = 1; n < 100; n++) {
		const candidate = n === 1 ? base : `${base}-${n}`;
		if (!(await isTaken(candidate))) {
			return candidate;
		}
	}
	throw new ORPCError("BAD_REQUEST", {
		message: "Could not allocate a unique slug",
	});
}

/** Per-user unique document slug, canonical slugify from `#/lib/slug.ts`. */
export function uniqueDocumentSlug(userId: string, title: string) {
	const base = slugify(title, "document", DOCUMENT_SLUG_MAX);
	return firstAvailableSlug(base, async (candidate) => {
		const [taken] = await db
			.select({ id: documents.id })
			.from(documents)
			.where(
				and(eq(documents.createdBy, userId), eq(documents.slug, candidate)),
			)
			.limit(1);
		return Boolean(taken);
	});
}

/** Per-user unique project slug (slugified, not just lowercased). */
export function uniqueProjectSlug(userId: string, desired: string) {
	const base = slugify(desired, "project", PROJECT_SLUG_MAX);
	return firstAvailableSlug(base, async (candidate) => {
		const [taken] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.createdBy, userId), eq(projects.slug, candidate)))
			.limit(1);
		return Boolean(taken);
	});
}

export function slugForNewProject(name: string, explicit?: string): string {
	return (explicit?.trim() || slugifyProject(name)).toLowerCase();
}

export interface PageCursor {
	id: string;
	sortAt: Date;
}

/**
 * Resolve an opaque cursor id to the sort timestamp of the row it points at.
 * Throws BAD_REQUEST when the row doesn't exist for this owner — silently
 * restarting at page one would return duplicate items.
 */
export async function pageCursor(
	cursor: string | undefined,
	fetchSortAt: (id: string) => Promise<Date | undefined>,
): Promise<PageCursor | undefined> {
	if (!cursor) {
		return undefined;
	}
	const sortAt = await fetchSortAt(cursor);
	if (!sortAt) {
		throw new ORPCError("BAD_REQUEST", { message: "Bad cursor" });
	}
	return { id: cursor, sortAt };
}

/** Keyset predicate advancing past `cursor` for a `(sortAt, id)` desc order. */
export function afterCursor(
	sortColumn: AnyColumn,
	idColumn: AnyColumn,
	cursor: PageCursor,
) {
	return or(
		lt(sortColumn, cursor.sortAt),
		and(eq(sortColumn, cursor.sortAt), lt(idColumn, cursor.id)),
	);
}

/** Shared limit+1 slicing for cursor pagination. */
export function paginate<T>(
	rows: T[],
	limit: number,
	cursorOf: (last: T) => string,
) {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;
	const last = items.at(-1);
	const nextCursor = hasMore && last ? cursorOf(last) : undefined;
	return { items, nextCursor };
}
