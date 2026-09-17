# AGENTS.md

Bun monorepo: product web app (`Planner Q3`), device agent (`uma-machine`), repo CLI (`uma`), Astro docs site, frozen wire contract, and Pulumi infra. Start from `docs/README.md` — it is the maintained repo map, context map (Planner Q3 upstream, Machine Execution downstream/conformist), and wiring-drift list.

## Architecture

- `apps/web` — product app: TanStack Start (React 19, file-based routes in `src/routes/`), oRPC API (`src/rpc/`, `src/routes/api/rpc.$.ts`), Drizzle/PostgreSQL (`src/schemas/db/`, migrations in `drizzle/`), better-auth. Read `apps/web/docs/CONTEXT.md` (domain vocabulary with explicit "avoid" terms) and `apps/web/docs/STYLE_GUIDE.md` before changing product behavior or UI; decisions in `apps/web/docs/adr/`. Has its own `apps/web/AGENTS.md`.
- `apps/machine` — `uma-machine`: CLI + daemon that runs Tasks in microsandbox sandboxes (Bun + SQLite). Its server side lives in `apps/web` (`src/lib/machines/`, `device.*`/`machines.*` oRPC procedures, `/api/machines/ws` Nitro websocket). Read `apps/machine/docs/ARCHITECTURE.md` for the module/port map, plus `CONTEXT.md` and `DOMAIN-MODELS.md`. Has its own `apps/machine/AGENTS.md`.
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames. Both `apps/machine` and `apps/web` import it as `@uma/orpc-contract` (workspace dep); `apps/machine` must never import from its own consumer apps. Policy/frame catalog in `apps/orpc-contract/docs/` (`FRAMES.md`, `VERSIONING.md`). Wire-frame changes require a major version and `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker + pgBackRest) and the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`; stack `dev` uses local Docker, other stacks provision an OCI VM. DB backup wiring is commented out; runbook in `docs/do-not-touch-ai/BACKUPS.md`, ops warnings in `README-dev.md`. Has its own `apps/infra/AGENTS.md`.
- `apps/cli` — `uma` repo CLI + docs MCP server (`read_docs`/`query_docs` over all repo markdown). See `apps/cli/README.md` and `apps/cli/AGENTS.md`.
- `apps/documentation` — Astro/fumadocs docs site. NOT in the root tsconfig `references`; Biome linting is disabled for it (see `biome.json` overrides). Has its own `apps/documentation/AGENTS.md`.
- `docs/do-not-touch-ai/` — frozen product theory (`PRINCIPLES.md`, `REFERENCE.md`) and backup runbook. Do not restructure; its `REFERENCE.md` links assume a pre-move layout.

## Setup

- Root `package.json` has `workspaces` (`apps/*`) with a dependency `catalog`: run `bun install` at the root once to install everything. Add shared deps to the root catalog and reference them as `"dep": "catalog:"` in app manifests.
- `bunfig.toml` sets `ignore-scripts = true` (no postinstall scripts run). `minimumReleaseAge` is commented out; the 3-day release-age rule is applied by `bun run update-deps` (taze), so keep new pins ≥3 days old.
- Generated files are gitignored or codegen-owned — never hand-edit:
  - `apps/web/src/routeTree.gen.ts` — `bun run gen:routes` in `apps/web`
  - `apps/web/src/schemas/db/auth.gen.ts` — `bun run gen:auth-schema` in `apps/web` (goes through `run:dev`, so it needs the Pulumi env like `dev` does)
  - `apps/machine/docs/wire-schema.json` — `bun run docs:wire` in `apps/machine`

## Commands

- Install: `bun install` at the repo root (once; covers all `apps/*` workspaces).
- Lint/format (Biome is the only formatter/linter — never Prettier/ESLint):
  - `bun run check:lint` at root (`biome check --fix .`: format + lint + import ordering).
  - `bun run format` at root (`biome format --fix .`; this is what the pre-commit hook runs).
  - Import grouping is enforced by Biome assist (`biome.json`: URL, NODE, BUN, PACKAGE_WITH_PROTOCOL, PACKAGE, ALIAS, PATH groups) — do not hand-order imports, just run the check.
- Typecheck per app, not at the root: root `bun run check:types` sweeps every app including `apps/documentation` (Astro virtual modules) and fails. Use `cd apps/<app> && bunx tsc --noEmit`.
- Web (in `apps/web`): `bun run dev` and `db:push`/`db:studio` go through `bun run:dev --`, which sources env from the Pulumi `dev` stack via `apps/infra/utils/run-command.ts` — needs the `pulumi` CLI and `PULUMI_CONFIG_PASSPHRASE` when non-interactive. `bun run build` = `vite build`. Codegen: `bun run gen:routes`, `bun run gen:auth-schema`.
- Machine (in `apps/machine`): `bun test` (all), `bun test tests/env.test.ts` (single file), `bun test -t "name"` (single test by name). Tests don't need the `msb` system runtime — sandbox tests use the mock driver (`MSB_MOCK=1` / `UMA_MSB_MOCK=1`). SQLite migrations are not a script: `migrate()` in `src/utils/client.ts:102-109` (re-exported by `src/utils/db.ts:38`) runs at startup. `bun run roundtrip` = end-to-end smoke test against the web dev server (defaults to `--server http://127.0.0.1:3000`, override with the flag); `bun run build` = compiled single binary; `bun run docs:wire` regenerates the wire snapshot. There is no local contract-server script.
- CLI (in `apps/cli`): `bun test` (all), `bun test tests/docs.test.ts` (single file), `bun test -t "name"` (single test). `bun run build` = compiled single binary → `.output/uma`. Run directly without building: `bun src/index.ts docs list`, `bun src/index.ts mcp start --port <n>`.
- Infra: `bun run infra:up|infra:preview|infra:refresh|infra:destroy --stack <name>` at the root (thin wrappers over `pulumi`). Never run these against non-`dev` stacks without explicit user approval.
- Docs site (in `apps/documentation`): `bun run dev`, `bun run build`, `bun run preview` (Astro). Biome lint is disabled for this app; its own `lint`/`format` scripts exist but are not part of the root check.
- Commits: Conventional Commits enforced by commitlint/husky; `wip` is an allowed type. Pre-commit hook runs `bun run format` — expect it to touch files.

## Code style

- Formatting: tabs, double quotes, semicolons, trailing commas — enforced by Biome. Do not reformat unrelated files; run `bun run check:lint` scope is repo-wide but prefer committing only your touched files plus Biome's fixes to them.
- Imports: explicit `.ts`/`.tsx` extensions on all relative imports (`allowImportingTsExtensions` is on; the bundler resolves them). `verbatimModuleSyntax` is on — use `import type` for type-only imports. `apps/web` resolves `#/*` to `src/*`; `apps/machine`, `apps/cli`, and `apps/infra` use relative paths only.
- TypeScript is strict: `strict`, `noUncheckedIndexedAccess` (every index access yields `T | undefined` — handle it, don't non-null-assert), `exactOptionalPropertyTypes` (don't assign `undefined` to an optional prop unless declared), `noUnusedLocals`/`noUnusedParameters`, `useUnknownInCatchVariables` (`catch (e)` is `unknown` — narrow with `e instanceof Error`, see `errorMessage()` in `apps/machine/src/index.ts`). `noUncheckedSideEffectImports` — side-effect imports must resolve. Prefer `z.coerce.*.catch(fallback)` over hand-rolled parsing for env/CLI coercion (see `apps/machine/src/utils/env.ts`).
- Naming: files are kebab-case in `machine`/`cli`/`infra` (`git-binding.ts`, `ws-client.ts`, `extract-env.ts`); React components are PascalCase (`AppShell.tsx`), colocated helpers camelCase (`badges.ts`). DB columns are snake_case mapped via Drizzle (`text("project_id")` ↔ `projectId`); pgEnums are named `snake_case` (`task_status`). Domain terms come from the CONTEXT docs — documents use `state`, tasks/connections use `status`; never swap them. Each CONTEXT doc has an "avoid" list; follow it.
- Validation with Zod at every trust boundary: oRPC procedure inputs, ws frame parsing (`parseServerFrame` inbound / machine-side `assertMachineFrame` in `apps/machine/src/execution/protocol.ts:15` wrapping `validateMachineFrame` on every outbound `send`), `identity.json`/`limits.json`, CLI `--only`/`--interval` coercion, env vars (`apps/web/src/env.ts` via `@t3-oss/env-core`, `apps/machine/src/utils/env.ts` via Zod). Never trust raw `process.env`, `JSON.parse`, or inbound frames without a schema.
- Error handling: in `apps/web` procedures throw `new ORPCError("<CODE>", { message })` (`NOT_FOUND`, `BAD_REQUEST`, `FORBIDDEN`, `INTERNAL_SERVER_ERROR`; contract-first paths use `throw errors.NOT_FOUND()`). In `apps/machine`/`apps/cli`, exit codes are the contract: `0` ok, `2` drifted/partial, `1` error, `3` upgrade-required; CLI human errors go to `console.error` + nonzero exit, `--json` mode prints machine-readable JSON. Redact before logging: use `Redactor`/`safeError(...).slice(0, 300)` — never print tokens, provider keys, or `GH_TOKEN` raw. Fails-closed beats best-effort where secrets are involved (`redactObject` throws rather than sending unredacted).
- Data access: Drizzle only, no raw SQL except inside `sql` template literals for aggregates/CHECKS. Server stamps all lifecycle timestamps (client-supplied timestamps are ignored). Enforce ownership in every query (`eq(table.userId, user.id)`); check parent ownership before touching child rows (task logs via parent task). Machine SQLite schema is additive only (`CREATE TABLE/INDEX IF NOT EXISTS` + `ADD COLUMN`, `PRAGMA user_version` mirrors `SCHEMA_VERSION`) — never destructive migrations.
- oRPC: new web API surface is contract-first (`implementer` from `#/rpc/contract.ts` backed by `@uma/orpc-contract`); older namespaces are plain `os` procedures migrating incrementally. Never invent a second API style — follow the file you are editing, prefer `implementer` for new namespaces.
- UI (web only): `apps/web/docs/STYLE_GUIDE.md` is law — dark-only tokens, no arbitrary CSS values (`bg-[#...]`), no light-mode branches, `variant="primary"` only for *New …* creators, shared `stateBadgeClass()`/`taskBadgeClass()` helpers instead of per-page clones, motion via the `motion` library tokens (never hand-rolled keyframes).
- Tests use `bun:test` (`describe`/`test`/`expect`). Save/restore mutated `process.env` keys in `afterEach` (see `apps/machine/tests/env.test.ts`); use `mkdtemp` + `rm -r` for filesystem fixtures (see `apps/cli/tests/docs.test.ts`); inject fakes via function args (`emit`/`claim`/`agentBin`, never singletons) and use `MSB_MOCK=1` / constructor-injectable mock paths for sandbox tests. Web has no unit-test setup — verify via `tsc --noEmit` + `vite build`, and the machine `roundtrip` smoke test for end-to-end.

## Env vars

- App env vars are declared once in `apps/infra/utils/extract-env.ts` (`APP_ENV_VARS` manifest). When adding one, also update `apps/web/src/env.ts` (validation) and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*` build vars; secrets are runtime-only). Values come from Pulumi stack config; never commit `.env` files or real secrets.

## Known wiring drift (verify before trusting)

Infra move (`apps/web` → `apps/infra`) path fallout is fixed: `apps/infra/docker/app.ts` builds from the repo-root context with `apps/web/Dockerfile`, `apps/infra/utils/run-command.ts` resolves the repo root where `Pulumi.yaml` lives, and `bun run check:env` in `apps/web` verifies the env manifest against the Dockerfile and `apps/web/src/env.ts`.
- `README-dev.md` tracks known ops gaps (silent backup failures, unplumbed `backup:CIPHER_PASS`, no restore tooling).
