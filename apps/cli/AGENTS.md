# AGENTS.md — apps/cli (uma)

Repo CLI + docs MCP server (`uma mcp start`, `uma docs …`). Bun + TypeScript. Serves repo markdown (`docs/`, `apps/*/docs/`, root `*.md`) to agents. See `README.md` for protocol details.

## Commands (run in `apps/cli`)

- `bun src/index.ts docs list [--root <dir>] [--json]` — list doc corpus.
- `bun src/index.ts docs read <path> [--root <dir>]` — read one doc.
- `bun src/index.ts docs query <text...> [--limit <n>] [--json]` — full-text search (default 10, max 50).
- `bun src/index.ts mcp start [--port <n>] [--host <h>] [--root <dir>] [--stdio]` — stdio by default; `--port` serves Streamable HTTP (`POST /mcp`, stateless, fresh server per request) on `127.0.0.1`; `--stdio` runs both.
- `bun test` — all tests. `bun test tests/docs.test.ts` — single file. `bun test -t "name"` — single test by name.
- `bun run build` — compiled single binary → `.output/uma`. `bun run dev` — `bun run src/index.ts`.
- Typecheck: `bunx tsc --noEmit` (in this dir). Lint/format from root: `bun run check:lint` / `bun run format`.

## Conventions

- Relative imports with explicit `.ts` extensions, `import type` for types (`verbatimModuleSyntax`, strict TS incl. `noUncheckedIndexedAccess` — handle `T | undefined`, don't assert).
- Layout: `src/index.ts` = CLI dispatcher (composition root edge, keep thin); `src/cli.ts` = arg parsing + help; `src/docs.ts` = pure-filesystem corpus (`resolveRepoRoot`, `listDocFiles`, `readDoc`, `queryDocs`, no MCP dependency — shared by CLI and server); `src/mcp.ts` = `createMcpServer(root?)` + stdio/HTTP starters; `src/version.ts` = `CLI_VERSION` derived from `apps/machine/package.json` (keep that derivation; don't hardcode a version here).
- Repo-root resolution: `UMA_REPO_ROOT` env > walk up to `apps/cli/package.json` > `process.cwd()`. Honor `--root`/`UMA_REPO_ROOT` in every code path so tests and embeddings stay hermetic.
- Errors: typed `DocsError` with `code` (`BAD_PATH`, `NOT_FOUND`, …). Reject path traversal outside root, absolute paths, non-markdown extensions, and missing files; truncate reads at 200KB. Tests assert codes via `rejects.toMatchObject({ code })` (see `tests/docs.test.ts`).
- Tests (`bun:test`): `mkdtemp` + `rm -r` fixtures, no repo-filesystem access, clean up `UMA_REPO_ROOT` overrides in `finally`/`afterEach`.
- Deps stay minimal (`cac`, `es-toolkit`, `picocolors`, `@modelcontextprotocol/sdk`, `zod` via catalog). Add shared deps to the root catalog as `"dep": "catalog:"`.
