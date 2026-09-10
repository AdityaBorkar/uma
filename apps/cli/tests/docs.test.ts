import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	DocsError,
	listDocFiles,
	queryDocs,
	readDoc,
	resolveRepoRoot,
} from "../src/docs.ts";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "uma-cli-docs-"));
	await writeFile(join(dir, "README.md"), "# Root\n\nHeartbeat quota notes.\n");
	await writeFile(
		join(dir, "nested.mdx"),
		"# Nested\n\nSandbox execution details.\n",
	);
	await writeFile(join(dir, "notes.txt"), "not a doc\n");
});

afterEach(async () => {
	await rm(dir, { force: true, recursive: true });
});

describe("resolveRepoRoot", () => {
	test("UMA_REPO_ROOT wins", () => {
		process.env.UMA_REPO_ROOT = dir;
		try {
			expect(resolveRepoRoot()).toBe(dir);
		} finally {
			delete process.env.UMA_REPO_ROOT;
		}
	});

	test("walks up to apps/cli/package.json", async () => {
		delete process.env.UMA_REPO_ROOT;
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(dir, "apps", "cli"), { recursive: true });
		await writeFile(join(dir, "apps", "cli", "package.json"), "{}\n");
		expect(resolveRepoRoot(join(dir, "apps", "cli", "src"))).toBe(dir);
	});
});

describe("listDocFiles", () => {
	test("finds .md/.mdx, skips other extensions and node_modules", async () => {
		await writeFile(join(dir, "node_modules_fake.md"), "x\n");
		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(dir, "node_modules"));
		await writeFile(join(dir, "node_modules", "skip.md"), "x\n");
		const files = await listDocFiles(dir);
		expect(files).toEqual(["README.md", "nested.mdx", "node_modules_fake.md"]);
	});
});

describe("readDoc", () => {
	test("reads a repo-relative doc", async () => {
		const doc = await readDoc("README.md", dir);
		expect(doc.path).toBe("README.md");
		expect(doc.content).toContain("Heartbeat");
		expect(doc.truncated).toBe(false);
	});

	test("rejects traversal outside the root", async () => {
		await expect(readDoc("../secret.md", dir)).rejects.toBeInstanceOf(
			DocsError,
		);
		await expect(readDoc("/etc/passwd", dir)).rejects.toBeInstanceOf(DocsError);
	});

	test("rejects non-markdown and missing files", async () => {
		await expect(readDoc("notes.txt", dir)).rejects.toMatchObject({
			code: "BAD_PATH",
		});
		await expect(readDoc("missing.md", dir)).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});

describe("queryDocs", () => {
	test("ranks filename/heading/body hits and returns snippets", async () => {
		const hits = await queryDocs("heartbeat", { root: dir });
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0]?.path).toBe("README.md");
		expect(hits[0]?.snippet.toLowerCase()).toContain("heartbeat");
	});

	test("empty query matches nothing; limit is honored", async () => {
		expect(await queryDocs("   ", { root: dir })).toEqual([]);
		const hits = await queryDocs("md", { limit: 1, root: dir });
		expect(hits.length).toBeLessThanOrEqual(1);
	});
});
