import { ORPCError, os } from "@orpc/server";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import matter from "gray-matter";

import { db } from "#/lib/db.ts";
import { getOwnedDocument } from "#/lib/documents.server.ts";
import { type RpcContext, requireUser } from "#/rpc/auth.ts";
import {
	afterCursor,
	assertProjectOwned,
	pageCursor,
	paginate,
	uniqueDocumentSlug,
} from "#/rpc/scope.ts";
import {
	documentComments,
	documentCounters,
	documentEvents,
	documents,
} from "#/schemas/db/documents.ts";
import { projects } from "#/schemas/db/projects.ts";
import {
	CommentCreateInput,
	DocumentCreateInput,
	DocumentListInput,
	DocumentNumberInput,
	DocumentUpdateInput,
	documentMetaSchema,
} from "#/schemas/schema.ts";

/**
 * Allocate the next per-user document number atomically. The counter row is
 * upserted in the same transaction as the insert, so concurrent creations
 * can never collide (SOW §4/Risks).
 */
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function allocateNumber(tx: DbTransaction, userId: string) {
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
	kind?: string;
	labels?: string[];
	meta?: Record<string, unknown>;
	projectId?: string | null;
	title?: string;
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
	const meta: Record<string, unknown> = metaResult.data;
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

export const list = os
	.input(DocumentListInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const q = input?.q?.trim();
		const limit = input?.limit ?? 20;

		const conditions: SQL[] = [eq(documents.createdBy, user.id)];
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
				.where(and(eq(documents.id, id), eq(documents.createdBy, user.id)))
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

export const get = os
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { doc, projectName } = await getOwnedDocument(input.number, user.id);
		return { ...doc, projectName };
	});

export const create = os
	.input(DocumentCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		await assertProjectOwned(input.projectId, user.id);
		const { body, meta } = composeBody(input.body, {
			kind: input.kind,
			labels: input.labels,
			meta: input.meta,
			projectId: input.projectId,
			title: input.title,
		});
		const id = crypto.randomUUID();
		const slug = await uniqueDocumentSlug(user.id, input.title);

		return db.transaction(async (tx) => {
			const number = await allocateNumber(tx, user.id);
			const [row] = await tx
				.insert(documents)
				.values({
					body,
					createdBy: user.id,
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
			if (!row) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			await tx.insert(documentEvents).values({
				actorId: user.id,
				documentId: row.id,
				id: crypto.randomUUID(),
				kind: "opened",
				payload: {},
			});
			return row;
		});
	});

export const update = os
	.input(DocumentUpdateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { doc: existing } = await getOwnedDocument(input.number, user.id);

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
				? await uniqueDocumentSlug(user.id, input.title)
				: existing.slug;

		const [updated] = await db
			.update(documents)
			.set({
				body,
				...(input.labels !== undefined ? { labels: input.labels } : {}),
				meta,
				slug,
				title: input.title ?? existing.title,
				updatedAt: new Date(),
			})
			.where(eq(documents.id, existing.id))
			.returning();
		if (!updated) {
			throw new ORPCError("NOT_FOUND");
		}

		const events: Array<{
			actorId: string;
			documentId: string;
			id: string;
			kind: string;
			payload: Record<string, unknown>;
		}> = [];
		if (updated.title !== existing.title) {
			events.push({
				actorId: user.id,
				documentId: updated.id,
				id: crypto.randomUUID(),
				kind: "renamed",
				payload: { from: existing.title, to: updated.title },
			});
		}
		if (input.labels) {
			events.push(
				...toLabelEvents(existing.labels, updated.labels, updated.id, user.id),
			);
		}
		if (events.length > 0) {
			await db.insert(documentEvents).values(events);
		}
		return updated;
	});

export const close = os
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		return transitionState(input.number, user.id, "closed");
	});

export const reopen = os
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		return transitionState(input.number, user.id, "open");
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

	const [updated] = await db
		.update(documents)
		.set({
			closedAt: to === "closed" ? new Date() : null,
			state: to,
			updatedAt: new Date(),
		})
		.where(eq(documents.id, existing.id))
		.returning();
	if (!updated) {
		throw new ORPCError("NOT_FOUND");
	}
	await db.insert(documentEvents).values({
		actorId: userId,
		documentId: updated.id,
		id: crypto.randomUUID(),
		kind: to === "closed" ? "closed" : "reopened",
		payload: {},
	});
	return updated;
}

export const remove = os
	.input(DocumentNumberInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { doc: existing } = await getOwnedDocument(input.number, user.id);
		// Deletion is reserved for settled work — open documents must be closed
		// first (SOW §6: closing is a decision, deletion is not).
		if (existing.state !== "closed") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only closed documents can be deleted",
			});
		}
		await db.delete(documents).where(eq(documents.id, existing.id));
		return { ok: true };
	});

export const createComment = os
	.input(CommentCreateInput)
	.handler(async ({ input, context }) => {
		const ctx = context as RpcContext;
		const user = await requireUser(ctx.headers);
		const { doc } = await getOwnedDocument(input.documentNumber, user.id);
		return db.transaction(async (tx) => {
			const [row] = await tx
				.insert(documentComments)
				.values({
					authorId: user.id,
					body: input.body,
					documentId: doc.id,
					id: crypto.randomUUID(),
				})
				.returning();
			if (!row) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			await tx.insert(documentEvents).values({
				actorId: user.id,
				documentId: doc.id,
				id: crypto.randomUUID(),
				kind: "commented",
				payload: {},
			});
			return row;
		});
	});
