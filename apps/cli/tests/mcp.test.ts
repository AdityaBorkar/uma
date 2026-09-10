import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// biome-ignore lint/correctness/noUnresolvedImports: Biome 2.5.12 cannot resolve this package's exports wildcard; tsc and bun resolve these documented SDK subpaths.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// biome-ignore lint/correctness/noUnresolvedImports: see above.
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createMcpServer } from "../src/mcp.ts";

let dir: string;
let client: Client;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "uma-cli-mcp-"));
	await writeFile(join(dir, "HEARTBEAT.md"), "# Heartbeat\n\nQuota notes.\n");

	const server = createMcpServer(dir);
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	client = new Client({ name: "test-client", version: "0.0.0" });
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
});

afterEach(async () => {
	await client.close();
	await rm(dir, { force: true, recursive: true });
});

describe("uma-docs MCP tools", () => {
	test("exposes read_docs and query_docs", async () => {
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"query_docs",
			"read_docs",
		]);
	});

	test("read_docs returns file content", async () => {
		const res = await client.callTool({
			arguments: { path: "HEARTBEAT.md" },
			name: "read_docs",
		});
		const text = (res.content as Array<{ text: string }>)[0]?.text ?? "";
		expect(text).toContain("Quota notes.");
		expect(res.isError).toBeFalsy();
	});

	test("read_docs errors on missing files", async () => {
		const res = await client.callTool({
			arguments: { path: "missing.md" },
			name: "read_docs",
		});
		expect(res.isError).toBe(true);
	});

	test("query_docs returns ranked hits as JSON", async () => {
		const res = await client.callTool({
			arguments: { query: "heartbeat" },
			name: "query_docs",
		});
		const text = (res.content as Array<{ text: string }>)[0]?.text ?? "[]";
		const hits = JSON.parse(text) as Array<{ path: string }>;
		expect(hits[0]?.path).toBe("HEARTBEAT.md");
	});
});
