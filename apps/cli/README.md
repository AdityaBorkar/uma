# @uma/cli — `uma` repo CLI + docs MCP server

Bun + TypeScript. Serves the repo's markdown docs (`docs/`, `apps/*/docs/`,
root `*.md`) to agents over MCP, with local `docs` mirrors for debugging.

## Commands

```sh
cd apps/cli && bun install

bun src/index.ts mcp start [--port <n>] [--host <h>] [--root <dir>] [--stdio]
bun src/index.ts docs list [--root <dir>] [--json]
bun src/index.ts docs read <path> [--root <dir>]
bun src/index.ts docs query <text...> [--limit <n>] [--root <dir>] [--json]
bun src/index.ts version

bun test                    # all tests
bun run build               # compiled single binary -> .output/uma
```

`uma mcp start` defaults to stdio. `--port <n>` serves Streamable HTTP
(`POST /mcp`, stateless) on `127.0.0.1` instead; add `--stdio` to run both.
Repo-root resolution: `UMA_REPO_ROOT` env > walk up to `apps/cli/package.json`
> `process.cwd()`.

## MCP tools

- `read_docs { path }` — read one doc by repo-relative path
  (e.g. `docs/README.md`). Rejects traversal outside the root, non-markdown
  paths, and missing files; truncates reads at 200KB.
- `query_docs { query, limit? }` — full-text search over all repo markdown
  (default 10 hits, max 50). Returns ranked `{path, score, snippet}` JSON.

## Use from OpenCode

Stdio (`opencode.jsonc`):

```jsonc
{
  "mcp": {
    "servers": {
      "uma-docs": {
        "type": "local",
        "command": ["bun", "/abs/path/to/uma/apps/cli/src/index.ts", "mcp", "start"],
      },
    },
  },
}
```

HTTP (after `uma mcp start --port 3456`):

```jsonc
{
  "mcp": {
    "servers": {
      "uma-docs": {
        "type": "remote",
        "url": "http://127.0.0.1:3456/mcp",
      },
    },
  },
}
```

## Layout

- `src/index.ts` — CLI dispatcher (composition root edge). `src/cli.ts` — arg
  parsing + help text. `src/version.ts` — `CLI_VERSION` (derived from
  `apps/machine/package.json`).
- `src/docs.ts` — docs corpus: root resolution, `listDocFiles`, `readDoc`,
  `queryDocs`. Pure filesystem, no MCP dependency — shared by the CLI and the
  server.
- `src/mcp.ts` — `createMcpServer(root?)` + `startStdioServer` /
  `startHttpServer`. One fresh server per HTTP request (stateless); the CLI
  owns its root in both paths.
