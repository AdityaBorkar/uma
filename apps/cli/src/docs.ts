import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DOCS_FILE_EXTENSIONS = [".md", ".mdx"] as const;
/** `read_docs` returns at most this many UTF-8 bytes (remainder truncated). */
export const MAX_READ_BYTES = 200 * 1024;
/** Files larger than this are skipped by the `query_docs` index. */
export const MAX_INDEX_BYTES = 512 * 1024;

const SKIP_DIRS = new Set([
	".git",
	".local",
	".next",
	".output",
	".tanstack",
	".turbo",
	".wrangler",
	"build",
	"coverage",
	"dist",
	"node_modules",
	"vendor",
]);

export type DocsErrorCode =
	| "NOT_FOUND"
	| "OUT_OF_ROOT"
	| "BAD_PATH"
	| "NOT_A_FILE";

export class DocsError extends Error {
	readonly code: DocsErrorCode;
	constructor(code: DocsErrorCode, message: string) {
		super(message);
		this.name = "DocsError";
		this.code = code;
	}
}

export interface DocRead {
	content: string;
	/** Repo-relative posix path, as requested (normalized). */
	path: string;
	truncated: boolean;
}

export interface DocHit {
	path: string;
	score: number;
	snippet: string;
}

export interface QueryDocsOptions {
	limit?: number | undefined;
	root?: string | undefined;
}

/**
 * Resolve the monorepo root that owns the docs corpus.
 *
 * Precedence: `UMA_REPO_ROOT` env > walk up from `startDir` looking for
 * `apps/cli/package.json` > `process.cwd()`.
 */
export function resolveRepoRoot(startDir?: string): string {
	const explicit = process.env.UMA_REPO_ROOT;
	if (explicit && explicit.trim() !== "") return resolve(explicit.trim());
	const start = startDir ?? dirname(fileURLToPath(import.meta.url));
	let dir = resolve(start);
	while (true) {
		if (existsSync(join(dir, "apps", "cli", "package.json"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) return resolve(process.cwd());
		dir = parent;
	}
}

function isDocFile(name: string): boolean {
	const lower = name.toLowerCase();
	return DOCS_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function toPosix(p: string): string {
	return p.split(sep).join("/");
}

/** All markdown docs under `root`, as repo-relative posix paths, sorted. */
export async function listDocFiles(root?: string): Promise<string[]> {
	const resolved = root ? resolve(root) : resolveRepoRoot();
	async function walk(dir: string): Promise<string[]> {
		const entries = await readdir(dir, { withFileTypes: true });
		const found: string[] = [];
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (SKIP_DIRS.has(entry.name)) continue;
				found.push(...(await walk(join(dir, entry.name))));
			} else if (entry.isFile() && isDocFile(entry.name)) {
				found.push(toPosix(relative(resolved, join(dir, entry.name))));
			}
		}
		return found;
	}
	const out = await walk(resolved);
	out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	return out;
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Read one doc by repo-relative path (e.g. `docs/README.md`).
 * Throws {@link DocsError} on traversal, bad extension, or missing file.
 */
export async function readDoc(
	relPath: string,
	root?: string,
): Promise<DocRead> {
	const resolved = root ? resolve(root) : resolveRepoRoot();
	const cleaned = relPath.trim().replace(/^\.\//, "").replace(/^\/+/, "");
	if (cleaned === "" || cleaned.endsWith("/")) {
		throw new DocsError("BAD_PATH", `bad doc path: ${JSON.stringify(relPath)}`);
	}
	const abs = resolve(resolved, cleaned);
	const rel = relative(resolved, abs);
	if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
		throw new DocsError(
			"OUT_OF_ROOT",
			`doc path escapes the repo root: ${JSON.stringify(relPath)}`,
		);
	}
	if (!isDocFile(abs)) {
		throw new DocsError(
			"BAD_PATH",
			`not a markdown doc (want *.md/*.mdx): ${JSON.stringify(relPath)}`,
		);
	}
	let raw: Buffer;
	try {
		raw = await readFile(abs);
	} catch (e) {
		const err = e as NodeJS.ErrnoException;
		if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
			throw new DocsError(
				"NOT_FOUND",
				`doc not found: ${toPosix(rel)} (use query_docs or \`uma docs list\` to discover paths)`,
			);
		}
		if (err?.code === "EISDIR") {
			throw new DocsError("NOT_A_FILE", `not a file: ${toPosix(rel)}`);
		}
		throw new DocsError(
			"NOT_FOUND",
			`cannot read ${toPosix(rel)}: ${errorMessage(e)}`,
		);
	}
	if (raw.byteLength > MAX_READ_BYTES) {
		return {
			content: raw.subarray(0, MAX_READ_BYTES).toString("utf8"),
			path: toPosix(rel),
			truncated: true,
		};
	}
	return {
		content: raw.toString("utf8"),
		path: toPosix(rel),
		truncated: false,
	};
}

function tokenize(query: string): string[] {
	return query
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 2);
}

function countOccurrences(haystack: string, needle: string): number {
	let n = 0;
	let i = haystack.indexOf(needle);
	while (i !== -1) {
		n++;
		i = haystack.indexOf(needle, i + needle.length);
	}
	return n;
}

/**
 * Case-insensitive full-text search over the markdown corpus.
 * Scores filename hits > heading hits > body hits; empty query matches nothing.
 */
export async function queryDocs(
	query: string,
	opts?: QueryDocsOptions,
): Promise<DocHit[]> {
	const terms = tokenize(query);
	if (terms.length === 0) return [];
	const limit = Math.min(Math.max(opts?.limit ?? 10, 1), 50);
	const files = await listDocFiles(opts?.root);
	const hits: DocHit[] = [];
	for (const path of files) {
		let raw: Buffer;
		try {
			raw = await readFile(
				join(opts?.root ? resolve(opts.root) : resolveRepoRoot(), path),
			);
		} catch {
			continue;
		}
		if (raw.byteLength > MAX_INDEX_BYTES) continue;
		const text = raw.toString("utf8");
		const lower = text.toLowerCase();
		const fileName = path.toLowerCase();
		const lines = text.split("\n");
		let score = 0;
		for (const term of terms) {
			score += 10 * countOccurrences(fileName, term);
			let headingHits = 0;
			for (const line of lines) {
				if (line.startsWith("#"))
					headingHits += countOccurrences(line.toLowerCase(), term);
			}
			score += 5 * headingHits;
			score += Math.min(countOccurrences(lower, term), 20);
		}
		if (score <= 0) continue;
		hits.push({ path, score, snippet: makeSnippet(lines, terms) });
	}
	hits.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
	return hits.slice(0, limit);
}

function makeSnippet(lines: string[], terms: string[]): string {
	let at = lines.findIndex((line) => {
		const lower = line.toLowerCase();
		return terms.some((t) => lower.includes(t));
	});
	if (at === -1) {
		// Filename-only match: lead with the doc's opening lines.
		const head = lines
			.filter((l) => l.trim() !== "")
			.slice(0, 3)
			.join("\n");
		return head.slice(0, 500);
	}
	at = Math.max(0, at - 1);
	return lines
		.slice(at, at + 3)
		.join("\n")
		.slice(0, 500);
}
