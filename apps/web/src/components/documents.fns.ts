/**
 * Server function backing the document detail view. One call returns the raw
 * fields the editor needs, the server-rendered HTML, the project name, and
 * the event timeline — the client never sees compiler output or unsanitized
 * markup, and the page never refetches the same document through a second
 * data path.
 *
 * Document data comes from the control plane (`apps/server`) over oRPC HTTP;
 * MDX rendering stays local (no DB, presentation-only).
 */

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type router from "@uma/server/src/rpc/router.ts";

import {
	MdxRenderError,
	renderBody,
	splitFrontmatter,
} from "#/components/mdx.server.ts";
import { env } from "#/env.ts";
import { DocumentNumberInput } from "#/schemas/schema.ts";

export interface RenderedDocument {
	closedAt: string | null;
	createdAt: string;
	error?: string | undefined;
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

export interface DocumentEvent {
	actorId: string;
	createdAt: string;
	id: string;
	kind: string;
	payload: Record<string, FrontmatterValue>;
}

export interface DocumentPage {
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

/** oRPC HTTP serializes Dates to ISO strings; accept both shapes. */
function iso(value: Date | string): string {
	return typeof value === "string" ? value : value.toISOString();
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
		const link = new RPCLink({
			headers: () => getRequestHeaders(),
			origin: env.CONTROL_PLANE_URL,
			url: "/api/rpc",
		});
		const api = createORPCClient<RouterClient<typeof router>>(link);
		const [doc, eventRows] = await Promise.all([
			api.documents.get({ number: data.number }),
			api.documents.events({ number: data.number }),
		]);
		const [rendered] = await Promise.all([renderDocument(doc.body)]);

		return {
			document: {
				body: doc.body,
				closedAt: doc.closedAt ? iso(doc.closedAt) : null,
				createdAt: iso(doc.createdAt),
				error: rendered.error,
				frontmatter: rendered.frontmatter,
				html: rendered.html,
				kind: doc.kind,
				labels: doc.labels,
				meta: toJson(doc.meta) as Record<string, FrontmatterValue>,
				number: doc.number,
				projectId: doc.projectId,
				projectName: doc.projectName,
				slug: doc.slug,
				state: doc.state,
				title: doc.title,
				updatedAt: iso(doc.updatedAt),
			},
			events: eventRows.map((event) => ({
				actorId: event.actorId,
				createdAt: iso(event.createdAt),
				id: event.id,
				kind: event.kind,
				payload: toJson(event.payload) as Record<string, FrontmatterValue>,
			})),
		};
	});
