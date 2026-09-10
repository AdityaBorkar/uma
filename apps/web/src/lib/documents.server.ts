/**
 * Shared server-side document access. oRPC procedures and TanStack server
 * functions (`src/components/documents.fns.ts`) both go through here so
 * ownership checks, project-name joins, and discussion queries exist once.
 */

import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import {
	documentComments,
	documentEvents,
	documents,
} from "#/schemas/db/documents.ts";
import { projects } from "#/schemas/db/projects.ts";

export interface OwnedDocument {
	doc: typeof documents.$inferSelect;
	projectName: string | null;
}

export async function getOwnedDocument(
	number: number,
	userId: string,
): Promise<OwnedDocument> {
	const [row] = await db
		.select({ doc: documents, projectName: projects.name })
		.from(documents)
		.leftJoin(projects, eq(documents.projectId, projects.id))
		.where(and(eq(documents.number, number), eq(documents.createdBy, userId)))
		.limit(1);
	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Document not found" });
	}
	return row;
}

export async function getDocumentDiscussion(documentId: string) {
	const [comments, events] = await Promise.all([
		db
			.select({
				authorId: documentComments.authorId,
				body: documentComments.body,
				createdAt: documentComments.createdAt,
				id: documentComments.id,
			})
			.from(documentComments)
			.where(eq(documentComments.documentId, documentId))
			.orderBy(desc(documentComments.createdAt)),
		db
			.select({
				actorId: documentEvents.actorId,
				createdAt: documentEvents.createdAt,
				id: documentEvents.id,
				kind: documentEvents.kind,
				payload: documentEvents.payload,
			})
			.from(documentEvents)
			.where(eq(documentEvents.documentId, documentId))
			.orderBy(desc(documentEvents.createdAt)),
	]);
	return { comments, events };
}
