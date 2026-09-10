// biome-ignore lint/correctness/noUnresolvedImports: Biome 2.5.12 cannot resolve this package's exports wildcard; tsc and bun resolve these documented SDK subpaths.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// biome-ignore lint/correctness/noUnresolvedImports: see above.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// biome-ignore lint/correctness/noUnresolvedImports: see above.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { MAX_READ_BYTES, queryDocs, readDoc, resolveRepoRoot } from "./docs.ts";
import { CLI_VERSION } from "./version.ts";

export const MCP_SERVER_NAME = "uma-docs";
export const MCP_DEFAULT_HOST = "127.0.0.1";
export const MCP_PATH = "/mcp";

const READ_DOCS_DESCRIPTION =
	"Read one repo doc as markdown. `path` is repo-relative, e.g. 'docs/README.md' or 'apps/web/docs/CONTEXT.md'. Use query_docs (or `uma docs list`) to discover paths.";
const QUERY_DOCS_DESCRIPTION =
	"Full-text search over all repo markdown docs. Returns ranked {path, score, snippet} hits; read a hit in full with read_docs.";

function toolError(text: string) {
	return { content: [{ text, type: "text" as const }], isError: true };
}

/** Build the MCP server with the `read_docs` / `query_docs` tools. */
export function createMcpServer(root?: string): McpServer {
	const docsRoot = root ?? resolveRepoRoot();
	const server = new McpServer({ name: MCP_SERVER_NAME, version: CLI_VERSION });

	server.registerTool(
		"read_docs",
		{
			description: READ_DOCS_DESCRIPTION,
			inputSchema: {
				path: z
					.string()
					.min(1)
					.describe("Repo-relative markdown path, e.g. docs/README.md"),
			},
		},
		async ({ path }) => {
			try {
				const doc = await readDoc(path, docsRoot);
				const text = doc.truncated
					? `${doc.content}\n\n…(truncated to ${MAX_READ_BYTES} bytes; file is larger)`
					: doc.content;
				return { content: [{ text, type: "text" as const }] };
			} catch (e) {
				return toolError(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.registerTool(
		"query_docs",
		{
			description: QUERY_DOCS_DESCRIPTION,
			inputSchema: {
				limit: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.describe("Max hits to return (default 10, max 50)"),
				query: z
					.string()
					.min(1)
					.describe("Search text, e.g. 'heartbeat quota'"),
			},
		},
		async ({ limit, query }) => {
			try {
				const hits = await queryDocs(query, { limit, root: docsRoot });
				return {
					content: [
						{ text: JSON.stringify(hits, null, 2), type: "text" as const },
					],
				};
			} catch (e) {
				return toolError(e instanceof Error ? e.message : String(e));
			}
		},
	);

	return server;
}

/** Serve the MCP server on stdin/stdout (default `uma mcp start` mode). */
export async function startStdioServer(root?: string): Promise<void> {
	const server = createMcpServer(root);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

export interface HttpServerOptions {
	host?: string | undefined;
	port: number;
	root?: string | undefined;
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
		status,
	});
}

/**
 * Serve the MCP server over Streamable HTTP at `POST /mcp` (stateless: one
 * transport per request). Works with `Bun.serve`; returns the server.
 */
export function startHttpServer(opts: HttpServerOptions) {
	const host = opts.host ?? MCP_DEFAULT_HOST;
	const root = opts.root ?? resolveRepoRoot();
	const server = Bun.serve({
		fetch: async (req) => {
			const url = new URL(req.url);
			if (url.pathname !== MCP_PATH)
				return jsonResponse(404, { error: "not found" });
			if (req.method !== "POST") {
				return jsonResponse(405, { error: "method not allowed (use POST)" });
			}
			try {
				const mcp = createMcpServer(root);
				// No sessionIdGenerator = stateless: one transport per request.
				const transport = new WebStandardStreamableHTTPServerTransport();
				await mcp.connect(transport);
				return await transport.handleRequest(req);
			} catch (e) {
				return jsonResponse(500, {
					error: e instanceof Error ? e.message : String(e),
				});
			}
		},
		hostname: host,
		port: opts.port,
	});
	console.error(
		`uma-docs MCP (HTTP) listening on http://${host}:${server.port}${MCP_PATH}`,
	);
	return server;
}
