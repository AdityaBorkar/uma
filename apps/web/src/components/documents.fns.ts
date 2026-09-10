/**
 * Server function backing the document detail view. One call returns the raw
 * fields the editor needs, the server-rendered HTML, the project name, and
 * the discussion — the client never sees compiler output or unsanitized
 * markup, and the page never refetches the same document through a second
 * data path. Same structure as `session.ts`: server imports at module scope
 * are fine — handler bodies are stripped from the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import {
	MdxRenderError,
	renderBody,
	splitFrontmatter,
} from "#/components/mdx.server.ts";
import { getAuthSession } from "#/lib/auth/server.ts";
import {
	getDocumentDiscussion,
	getOwnedDocument,
} from "#/lib/documents.server.ts";
import { DocumentNumberInput } from "#/schemas/schema.ts";

export interface RenderedDocument {
	closedAt: string | null;
	createdAt: string;
	error?: string;
	frontmatter: Record<string, FrontmatterValue>;
	html: string | null;
	kind: string;
	labels: string[];
	number: number;
	projectId: string | null;
	projectName: string | null;
	state: "open" | "closed";
	title: string;
	updatedAt: string;
}

/** Raw editable fields the client needs in addition to the render output. */
export interface LoadedDocument extends RenderedDocument {
	body: string;
	meta: Record<string, FrontmatterValue>;
	slug: string;
}

export interface DocumentComment {
	authorId: string;
	body: string;
	createdAt: string;
	id: string;
}

export interface DocumentEvent {
	actorId: string;
	createdAt: string;
	id: string;
	kind: string;
	payload: Record<string, FrontmatterValue>;
}

export interface DocumentPage {
	comments: DocumentComment[];
	document: LoadedDocument;
	events: DocumentEvent[];
}

/** JSON-safe value: server functions reject non-serializable payloads. */
export type FrontmatterValue =
	| boolean
	| FrontmatterValue[]
	| null
	| number
	| string
	| { [key: string]: FrontmatterValue };

function toJson(value: unknown): FrontmatterValue {
	return JSON.parse(JSON.stringify(value ?? null)) as FrontmatterValue;
}

async function renderDocument(body: string): Promise<{
	error?: string;
	frontmatter: Record<string, FrontmatterValue>;
	html: string | null;
}> {
	try {
		const html = await renderBody(body);
		const frontmatter = Object.fromEntries(
			Object.entries(splitFrontmatter(body).data).map(([key, value]) => [
				key,
				toJson(value),
			]),
		);
		return { frontmatter, html };
	} catch (renderError) {
		// Recoverable by design (SOW D1 acceptance): bad MDX shows an
		// editable error, never a crash.
		if (!(renderError instanceof MdxRenderError)) {
			throw renderError;
		}
		return { error: renderError.message, frontmatter: {}, html: null };
	}
}

export const loadDocument = createServerFn({ method: "GET" })
	.validator((input: unknown) => DocumentNumberInput.parse(input))
	.handler(async ({ data }): Promise<DocumentPage> => {
		const session = await getAuthSession(getRequestHeaders());
		if (!session?.user) {
			throw new Error("Not authenticated");
		}
		const { doc, projectName } = await getOwnedDocument(
			data.number,
			session.user.id,
		);
		const [rendered, discussion] = await Promise.all([
			renderDocument(doc.body),
			getDocumentDiscussion(doc.id),
		]);

		return {
			comments: discussion.comments.map((comment) => ({
				...comment,
				createdAt: comment.createdAt.toISOString(),
			})),
			document: {
				body: doc.body,
				closedAt: doc.closedAt?.toISOString() ?? null,
				createdAt: doc.createdAt.toISOString(),
				error: rendered.error,
				frontmatter: rendered.frontmatter,
				html: rendered.html,
				kind: doc.kind,
				labels: doc.labels,
				meta: toJson(doc.meta) as Record<string, FrontmatterValue>,
				number: doc.number,
				projectId: doc.projectId,
				projectName,
				slug: doc.slug,
				state: doc.state,
				title: doc.title,
				updatedAt: doc.updatedAt.toISOString(),
			},
			events: discussion.events.map((event) => ({
				...event,
				createdAt: event.createdAt.toISOString(),
				payload: toJson(event.payload) as Record<string, FrontmatterValue>,
			})),
		};
	});
