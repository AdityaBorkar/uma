# AGENTS.md

Bun monorepo: product web app (`Planner Q3`), control-plane server,
device agent (`uma-machine`), repo CLI (`uma`), Astro docs site, frozen
wire contract, and Pulumi infra.
Start from `docs/README.md` — it is the maintained repo map, context map
(Planner Q3 upstream, Machine Execution downstream/conformist),
and wiring-drift list.

## Architecture

- `apps/web` — product UI: TanStack Start (React 19, file-based routes
  in `src/routes/`). No server code, no DB access — every data call goes
  over HTTP to the control plane (`apps/server`) via oRPC (`src/lib/rpc.ts`)
  or `apiUrl("/api/…")`. Read `apps/web/docs/CONTEXT.md` ("avoid" terms)
  and `docs/STYLE_GUIDE.md` before changing behavior/UI; decisions in
  `docs/adr/`.
- `apps/server` — control plane (`@uma/server`, `Bun.serve` on `:4000` in
  dev): oRPC API (`/api/rpc`, `/api/openapi`), better-auth
  (`/api/auth/*`), machine wire (`/api/machines/*` + WS), OAuth callbacks,
  debug/seed helpers. Owns Drizzle/PostgreSQL schemas (`src/db/`). Read
  `apps/server/AGENTS.md`; wire freeze in `apps/orpc-contract/docs/`.
- `apps/machine` — `uma-machine`: CLI + daemon running Tasks in microsandbox
  sandboxes (Bun + SQLite). Server side lives in `apps/server`
  (`src/machines/`, `device.*`/`machines.*` procedures, `/api/machines/ws`).
  Read `docs/ARCHITECTURE.md`, `CONTEXT.md`, `DOMAIN-MODELS.md`.
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames, consumed as
  `@uma/orpc-contract` (workspace dep). Policy in `docs/` (`FRAMES.md`,
  `VERSIONING.md`). Changes need a major version + `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker +
  pgBackRest) and the app env manifest. `Pulumi.yaml` at root points at
  `apps/infra/index.ts`; `dev` stack uses local Docker, others provision a VM.
- `apps/cli` — `uma` repo CLI + docs MCP server (`read_docs`/`query_docs`
  over all repo markdown). See `apps/cli/README.md`.
- `apps/documentation` — Astro/fumadocs docs site. NOT in root tsconfig
  `references`; Biome lint disabled for it (`biome.json` overrides).
- `docs/do-not-touch-ai/` — frozen product theory + backup runbook.
  Do not restructure; `REFERENCE.md` links assume a pre-move layout.

Each app has its own `AGENTS.md` (including `docs/AGENTS.md`) — read the one
for the app you are changing; this file is the cross-app index.

## Setup

- Runtime: Bun everywhere (`bunfig.toml` sets `ignore-scripts = true`).
  Install once at root: `bun install` (covers all `apps/*` workspaces).
- Shared deps live in the root `package.json` `catalog`, referenced as
  `"dep": "catalog:"`. New pins must be ≥3 days old — enforced by
  `bun run update-deps` (`taze -rw --maturity-period 3`), not by `bunfig.toml`.
- Web/infra dev commands need the `pulumi` CLI + `PULUMI_CONFIG_PASSPHRASE`
  when non-interactive (env comes from the `dev` stack via
  `apps/infra/utils/run-command.ts`).
- Generated files — never hand-edit, regenerate instead:
  - `apps/web/src/routeTree.gen.ts` via `bun run gen:routes` in `apps/web`
  - `apps/server/src/db/auth.gen.ts` via `bun run gen:auth-schema` in
    `apps/server` (needs Pulumi `dev` env, like `dev` does)
  - `apps/machine/docs/wire-schema.json` via `bun run docs:wire`

## Commands

- Lint/format (Biome only — never Prettier/ESLint): `bun run check:lint`
  (`biome check --fix .`) or `bun run format` at root (what the pre-commit
  hook runs — commit only your files plus its fixes). `apps/documentation`
  is excluded; it has local-only `bun run lint` / `bun run format`.
- Typecheck per app: `cd apps/<app> && bunx tsc --noEmit`. Root
  `bun run check:types` fails by design (Astro virtual modules).
- Tests use `bun:test` (`describe`/`test`/`expect`); no vitest/jest:
  - All: `bun test` (in `apps/machine` or `apps/cli`).
  - Single file: `bun test tests/env.test.ts` (machine) or
    `bun test tests/docs.test.ts` (cli).
  - Single test: `bun test -t "test name"` (substring match).
  - Sandbox tests need no `msb` runtime — mock driver via
    `MSB_MOCK=1` / `UMA_MSB_MOCK=1`.
  - Web has no unit tests — verify with `tsc --noEmit` + `vite build`;
    end-to-end via `bun run roundtrip` in `apps/machine`.
  - Infra / orpc-contract / documentation have no tests — verify with
    `tsc --noEmit` (+ `infra:preview --stack dev`, `astro build`).
- Web (in `apps/web`): `bun run dev`; `bun run:dev -- <cmd>` (any command
  with `dev` env); `bun run db:push` / `db:studio`; `bun run build`/`preview`
  (`vite`); `bun run check:env` (manifest vs Dockerfile vs `src/env.ts`).
- Machine (in `apps/machine`): `bun run src/index.ts <cmd>` (no build;
  `enroll|daemon|check|reset|sync|history|sandbox|run|version`);
  `bun run roundtrip` (smoke test vs web dev server, default
  `--server http://127.0.0.1:3000`); `bun run build` (→ `.output/uma-machine`).
  SQLite `migrate()` runs at startup (`src/utils/client.ts:102-109`).
- CLI (in `apps/cli`): `bun src/index.ts docs list`,
  `bun src/index.ts mcp start --port <n>`; `bun run build` (→ `.output/uma`).
- Infra (at root): `bun run infra:up|preview|refresh|destroy --stack <name>`.
  Never touch non-`dev` stacks without explicit user approval.
- Docs site (in `apps/documentation`): `bun run dev` (`start`), `build`,
  `preview`, `astro` (raw CLI).
- Commits: Conventional Commits via commitlint/husky (types = conventional
  set plus `wip`); pre-commit runs `bun run format`.

## Code style

- Formatting: tabs, double quotes, semicolons, trailing commas (Biome).
  Do not reformat unrelated files. Never hand-order imports — Biome assist
  enforces grouping (`biome.json`: URL, NODE, BUN, PACKAGE_WITH_PROTOCOL,
  PACKAGE, ALIAS, PATH); just run `check:lint`.
- Imports: explicit `.ts`/`.tsx` on relative imports
  (`allowImportingTsExtensions`); `import type` for types
  (`verbatimModuleSyntax`). `apps/web` uses the `#/*` → `src/*` alias;
  `machine`/`cli`/`infra` use relative paths only.
- TypeScript is strict (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`/`noUnusedParameters`,
  `useUnknownInCatchVariables`, `moduleDetection: force`). Index access gives
  `T | undefined` (handle it, never assert); `catch (e)` is `unknown`
  (narrow via `e instanceof Error`); prefer `z.coerce.*.catch(fallback)`
  for env/CLI coercion (see `apps/machine/src/utils/env.ts`).
- Naming: kebab-case files in `machine`/`cli`/`infra`; PascalCase React
  components (`AppShell.tsx`), camelCase helpers (`badges.ts`). DB columns
  snake_case ↔ camelCase fields; pgEnums `snake_case`. Documents use `state`,
  tasks/connections use `status` — never swap; follow each CONTEXT "avoid" list.
- Validation (Zod) at every trust boundary: oRPC inputs, ws frames
  (`parseServerFrame` inbound, `assertMachineFrame` wrapping
  `validateMachineFrame` on every outbound `send`), `identity.json` /
  `limits.json`, CLI flags, env (`apps/web/src/env.ts`, machine `utils/env.ts`).
  Never trust raw `process.env`, `JSON.parse`, or inbound frames.
- Error handling: web throws `new ORPCError("<CODE>", { message })`
  (contract-first: `throw errors.NOT_FOUND()`). `machine`/`cli` use exit
  codes (`0` ok, `2` drifted/partial, `1` error, `3` upgrade-required);
  `--json` prints machine-readable JSON. Redact before logging
  (`Redactor`/`safeError(...).slice(0, 300)`); fail closed on secrets.
- Data access: Drizzle only (raw SQL only in `sql` templates). Server stamps
  lifecycle timestamps; enforce ownership per query (`eq(table.userId, …)`);
  check parent ownership for child rows. Machine SQLite is additive-only
  (`IF NOT EXISTS` + `ADD COLUMN`, `PRAGMA user_version` = `SCHEMA_VERSION`).
- oRPC: new surface is contract-first (`implementer` from `#/rpc/contract.ts`);
  older `os` namespaces migrate incrementally. Follow the file you edit.
- UI (web): `STYLE_GUIDE.md` is law — dark-only tokens, no arbitrary values
  (`bg-[#...]`), no light branches, `primary` only for *New …* creators,
  shared `stateBadgeClass()`/`taskBadgeClass()`, `motion` tokens only.
- Tests: save/restore mutated `process.env` in `afterEach`; `mkdtemp` + `rm -r`
  fixtures; inject fakes via args (`emit`/`claim`/`agentBin`, never singletons).

## Env vars

- Declared once in `apps/infra/utils/extract-env.ts` (`APP_ENV_VARS`). Adding
  one also updates `apps/web/src/env.ts` and `apps/web/Dockerfile` (`ARG`
  only for `PUBLIC_*`; secrets runtime-only). Values come from Pulumi config;
  never commit `.env` files or real secrets.

## Safety rules

- Never run `infra:*` on non-`dev` stacks without explicit approval.
- Never log secrets — redact first, fail closed.
- Never hand-edit codegen output — regenerate.
- Never restructure `docs/do-not-touch-ai/` or add a second API style,
  linter, or test runner.
- Never commit `.env`/secrets; never use destructive migrations.
