import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import matter from "gray-matter";

import { type DbTx, db } from "../../db/client.ts";
import {
	documentCounters,
	documentEvents,
	documents,
} from "../../db/documents.ts";
import { projects } from "../../db/projects.ts";
import { getOwnedDocument } from "../../documents/documents.server.ts";
import {
	DocumentCreateInput,
	DocumentListInput,
	DocumentNumberInput,
	DocumentUpdateInput,
	documentMetaSchema,
} from "../../schemas/schema.ts";
import { authed } from "../auth.ts";
import {
	afterCursor,
	assertProjectOwned,
	isUniqueViolation,
	mustReturn,
	pageCursor,
	paginate,
	toConflict,
	uniqueDocumentSlug,
} from "../scope.ts";

/**
 * Allocate the next per-user document number atomically. The counter row is
 * upserted in the same transaction as the insert, so concurrent creations
 * can never collide (SOW §4/Risks).
 */

async function allocateNumber(tx: DbTx, userId: string) {
	const [row] = await tx
		.insert(documentCounters)
		.values({ nextNumber: 1, userId })
		.onConflictDoUpdate({
			set: { nextNumber: sql`${documentCounters.nextNumber} + 1` },
			target: documentCounters.userId,
		})
		.returning();
	if (!row?.nextNumber) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return row.nextNumber;
}

interface FrontmatterPatch {
	kind?: string | undefined;
	labels?: string[] | undefined;
	meta?: Record<string, unknown> | undefined;
	projectId?: string | null | undefined;
	title?: string | undefined;
}

/**
 * Merge explicit input over whatever frontmatter the caller put in the MDX
 * body, validate the kind-specific `meta`, and reserialize the body as a
 * complete MDX source (frontmatter block included). The returned `meta` is
 * the validated value the callers mirror into the queryable column, so body
 * and column can never drift.
 */
function composeBody(
	rawBody: string,
	patch: FrontmatterPatch,
): { body: string; meta: Record<string, unknown> } {
	let content = rawBody;
	let inlineData: Record<string, unknown> = {};
	try {
		const parsed = matter(rawBody);
		content = parsed.content;
		inlineData = parsed.data;
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Frontmatter block is malformed YAML",
		});
	}

	const merged: Record<string, unknown> = { ...inlineData };
	for (const [key, value] of Object.entries(patch)) {
		if (value !== undefined && value !== null && value !== "") {
			merged[key] = value;
		}
	}

	const kind = merged.kind;
	if (typeof kind !== "string") {
		throw new ORPCError("BAD_REQUEST", { message: "kind is required" });
	}
	const rawMeta = (merged.meta ?? {}) as Record<string, unknown>;
	const metaResult = documentMetaSchema(kind).safeParse(rawMeta);
	if (!metaResult.success) {
		throw new ORPCError("UNPROCESSABLE_CONTENT", {
			data: metaResult.error.flatten(),
			message: `Invalid frontmatter for kind "${kind}": ${metaResult.error.issues[0]?.message}`,
		});
	}
	const meta = metaResult.data as Record<string, unknown>;
	merged.meta = meta;

	return {
		body: matter.stringify(content.trimStart(), merged),
		meta,
	};
}

function toLabelEvents(
	before: string[],
	after: string[],
	documentId: string,
	actorId: string,
) {
	const beforeSet = new Set(before);
	const afterSet = new Set(after);
	const events: Array<{
		actorId: string;
		documentId: string;
		id: string;
		kind: string;
		payload: Record<string, unknown>;
	}> = [];
	for (const label of afterSet) {
		if (!beforeSet.has(label)) {
			events.push({
				actorId,
				documentId,
				id: crypto.randomUUID(),
				kind: "labeled",
				payload: { label },
			});
		}
	}
	for (const label of beforeSet) {
		if (!afterSet.has(label)) {
			events.push({
				actorId,
				documentId,
				id: crypto.randomUUID(),
				kind: "unlabeled",
				payload: { label },
			});
		}
	}
	return events;
}

export const list = authed
	.input(DocumentListInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const q = input?.q?.trim();
		const limit = input?.limit ?? 20;

		const conditions: SQL[] = [eq(documents.createdBy, userId)];
		if (input?.kind) {
			conditions.push(eq(documents.kind, input.kind));
		}
		if (input?.kinds && input.kinds.length > 0) {
			conditions.push(inArray(documents.kind, input.kinds));
		}
		if (input?.state) {
			conditions.push(eq(documents.state, input.state));
		}
		if (input?.projectId) {
			conditions.push(eq(documents.projectId, input.projectId));
		}
		if (input?.label) {
			conditions.push(sql`${input.label} = ANY(${documents.labels})`);
		}
		if (q) {
			conditions.push(
				sql`${documents.search} @@ websearch_to_tsquery('english', ${q})`,
			);
		}

		const cursor = await pageCursor(input?.cursor, async (id) => {
			const [row] = await db
				.select({ createdAt: documents.createdAt })
				.from(documents)
				.where(and(eq(documents.id, id), eq(documents.createdBy, userId)))
				.limit(1);
			return row?.createdAt;
		});

		const rows = await db
			.select({
				closedAt: documents.closedAt,
				createdAt: documents.createdAt,
				id: documents.id,
				kind: documents.kind,
				labels: documents.labels,
				number: documents.number,
				projectId: documents.projectId,
				projectName: projects.name,
				slug: documents.slug,
				state: documents.state,
				title: documents.title,
				updatedAt: documents.updatedAt,
			})
			.from(documents)
			.leftJoin(projects, eq(documents.projectId, projects.id))
			.where(
				and(
					...conditions,
					cursor
						? afterCursor(documents.createdAt, documents.id, cursor)
						: undefined,
				),
			)
			.orderBy(desc(documents.createdAt), desc(documents.id))
			.limit(limit + 1);

		const { items, nextCursor } = paginate(rows, limit, (last) => last.id);
		return { items, nextCursor };
	});

export const get = authed
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const { doc, projectName } = await getOwnedDocument(
			input.number,
			context.user.id,
		);
		return { ...doc, projectName };
	});

/**
 * Event timeline for the document detail view. Scoped through the same
 * ownership check as `get` (number → owned doc → events by id), so callers
 * can never enumerate another user's events.
 */
export const events = authed
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const { doc } = await getOwnedDocument(input.number, context.user.id);
		return db
			.select({
				actorId: documentEvents.actorId,
				createdAt: documentEvents.createdAt,
				id: documentEvents.id,
				kind: documentEvents.kind,
				payload: documentEvents.payload,
			})
			.from(documentEvents)
			.where(eq(documentEvents.documentId, doc.id))
			.orderBy(desc(documentEvents.createdAt));
	});

export const create = authed
	.input(DocumentCreateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		await assertProjectOwned(input.projectId, userId);
		const { body, meta } = composeBody(input.body, {
			kind: input.kind,
			labels: input.labels,
			meta: input.meta,
			projectId: input.projectId,
			title: input.title,
		});
		const id = crypto.randomUUID();
		const slug = await uniqueDocumentSlug(userId, input.title);

		try {
			return await db.transaction(async (tx) => {
				const number = await allocateNumber(tx, userId);
				const [row] = await tx
					.insert(documents)
					.values({
						body,
						createdBy: userId,
						id,
						kind: input.kind,
						labels: input.labels ?? [],
						meta,
						number,
						projectId: input.projectId,
						slug,
						title: input.title,
					})
					.returning();
				const created = mustReturn(row);
				await tx.insert(documentEvents).values({
					actorId: userId,
					documentId: created.id,
					id: crypto.randomUUID(),
					kind: "opened",
					payload: {},
				});
				return created;
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A document with this slug already exists");
			}
			throw error;
		}
	});

export const update = authed
	.input(DocumentUpdateInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const { doc: existing } = await getOwnedDocument(input.number, userId);

		// kind + projectId are locked after creation — the update input type
		// no longer carries them, so there is nothing to reject here.
		const { body, meta } = composeBody(existing.body, {
			kind: existing.kind,
			labels: input.labels,
			meta: input.meta,
			projectId: existing.projectId,
			title: input.title,
		});
		const slug =
			input.title && input.title !== existing.title
				? await uniqueDocumentSlug(userId, input.title)
				: existing.slug;

		const renamedEvent =
			input.title !== undefined && input.title !== existing.title
				? [
						{
							actorId: userId,
							documentId: existing.id,
							id: crypto.randomUUID(),
							kind: "renamed",
							payload: { from: existing.title, to: input.title },
						},
					]
				: [];
		const labelEvents =
			input.labels !== undefined
				? toLabelEvents(existing.labels, input.labels, existing.id, userId)
				: [];

		try {
			return await db.transaction(async (tx) => {
				const [updated] = await tx
					.update(documents)
					.set({
						body,
						...(input.labels !== undefined ? { labels: input.labels } : {}),
						meta,
						slug,
						title: input.title ?? existing.title,
						updatedAt: new Date(),
					})
					.where(
						and(eq(documents.id, existing.id), eq(documents.createdBy, userId)),
					)
					.returning();
				const row = mustReturn(updated, "Document not found");
				const events = [...renamedEvent, ...labelEvents];
				if (events.length > 0) {
					await tx.insert(documentEvents).values(events);
				}
				return row;
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw toConflict("A document with this slug already exists");
			}
			throw error;
		}
	});

export const close = authed
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		return transitionState(input.number, context.user.id, "closed");
	});

export const reopen = authed
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		return transitionState(input.number, context.user.id, "open");
	});

async function transitionState(
	number: number,
	userId: string,
	to: "open" | "closed",
) {
	const { doc: existing } = await getOwnedDocument(number, userId);
	if (existing.state === to) {
		return existing;
	}

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(documents)
			.set({
				closedAt: to === "closed" ? new Date() : null,
				state: to,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(documents.id, existing.id),
					eq(documents.createdBy, userId),
					// Guarded: a concurrent close/reopen interleaving loses instead
					// of silently winning and orphaning its event.
					eq(documents.state, existing.state),
				),
			)
			.returning();
		const row = mustReturn(updated, "Document not found");
		await tx.insert(documentEvents).values({
			actorId: userId,
			documentId: row.id,
			id: crypto.randomUUID(),
			kind: to === "closed" ? "closed" : "reopened",
			payload: {},
		});
		return row;
	});
}

export const remove = authed
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const userId = context.user.id;
		const { doc: existing } = await getOwnedDocument(input.number, userId);
		// Deletion is reserved for settled work — open documents must be closed
		// first (SOW §6: closing is a decision, deletion is not).
		if (existing.state !== "closed") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only closed documents can be deleted",
			});
		}
		await db
			.delete(documents)
			.where(
				and(eq(documents.id, existing.id), eq(documents.createdBy, userId)),
			);
		return { ok: true };
	});
