import { ORPCError } from "@orpc/server";
import { type AnyColumn, and, eq, lt, or } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import { slugify, slugifyProject } from "#/lib/slug.ts";
import { documents } from "#/schemas/db/documents.ts";
import { projects } from "#/schemas/db/projects.ts";
import { signals } from "#/schemas/db/tasks.ts";

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

export async function assertSignalOwned(signalId: string, userId: string) {
	const [row] = await db
		.select({ id: signals.id })
		.from(signals)
		.where(and(eq(signals.id, signalId), eq(signals.userId, userId)))
		.limit(1);
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Signal not found" });
	}
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
	const base = slugify(title, "document", 80);
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

/** Per-user unique project slug. */
export function uniqueProjectSlug(userId: string, desired: string) {
	const base = desired.toLowerCase();
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
