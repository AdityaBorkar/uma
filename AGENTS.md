# AGENTS.md

Bun monorepo: product web app (`Planner Q3`), device agent (`uma-machine`), repo CLI (`uma`), Astro docs site, frozen wire contract, and Pulumi infra. Start from `docs/README.md` — it is the maintained repo map, context map (Planner Q3 upstream, Machine Execution downstream/conformist), and wiring-drift list.

## Architecture

- `apps/web` — product app: TanStack Start (React 19, file-based routes in `src/routes/`), oRPC API (`src/rpc/`, `src/routes/api/rpc.$.ts`), Drizzle/PostgreSQL (`src/schemas/db/`, migrations in `drizzle/`), better-auth. Read `apps/web/docs/CONTEXT.md` (domain vocabulary with explicit "avoid" terms) and `apps/web/docs/STYLE_GUIDE.md` before changing product behavior or UI; decisions in `apps/web/docs/adr/`.
- `apps/machine` — `uma-machine`: CLI + daemon that runs Tasks in microsandbox sandboxes (Bun + SQLite). Its server side lives in `apps/web` (`src/lib/machines/`, `device.*`/`machines.*` oRPC procedures, `/api/machines/ws` Nitro websocket). Read `apps/machine/docs/ARCHITECTURE.md` for the module/port map, plus `CONTEXT.md` and `DOMAIN-MODELS.md`.
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames. Both `apps/machine` and `apps/web` import it as `@uma/orpc-contract` (workspace dep); `apps/machine` must never import from its own consumer apps. Policy/frame catalog in `apps/orpc-contract/docs/` (`FRAMES.md`, `VERSIONING.md`). Wire-frame changes require a major version and `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker + pgBackRest) and the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`; stack `dev` uses local Docker, other stacks provision an OCI VM. DB backup wiring is commented out; runbook in `docs/do-not-touch-ai/BACKUPS.md`, ops warnings in `README-dev.md`.
- `apps/cli` — `uma` repo CLI + docs MCP server (`read_docs`/`query_docs` over all repo markdown). See `apps/cli/README.md`.
- `apps/documentation` — Astro/fumadocs docs site. NOT in the root tsconfig `references`; Biome linting is disabled for it (see `biome.json` overrides).
- `docs/do-not-touch-ai/` — frozen product theory (`PRINCIPLES.md`, `REFERENCE.md`) and backup runbook. Do not restructure; its `REFERENCE.md` links assume a pre-move layout.

## Setup

- Root `package.json` has `workspaces` (`apps/*`) with a dependency `catalog`: run `bun install` at the root once to install everything. Add shared deps to the root catalog and reference them as `"dep": "catalog:"` in app manifests.
- `bunfig.toml` sets `ignore-scripts = true` (no postinstall scripts run). `minimumReleaseAge` is commented out; the 3-day release-age rule is applied by `bun run update-deps` (taze), so keep new pins ≥3 days old.
- Generated files are gitignored or codegen-owned — never hand-edit:
  - `apps/web/src/routeTree.gen.ts` — `bun run gen:routes` in `apps/web`
  - `apps/web/src/schemas/db/auth.gen.ts` — `bun run gen:auth-schema` in `apps/web` (goes through `run:dev`, so it needs the Pulumi env like `dev` does)
  - `apps/machine/docs/wire-schema.json` — `bun run docs:wire` in `apps/machine`

## Commands

- Root: `bun run check:lint` (Biome `check --fix`, format + lint + import ordering — Biome is the only formatter/linter) and `bun run format` (what the pre-commit hook runs).
- Typecheck per app, not at the root: root `bun run check:types` sweeps every app including `apps/documentation` (Astro virtual modules) and fails. Use `cd apps/<app> && bunx tsc --noEmit`.
- Web (in `apps/web`): `bun run dev` and `db:push`/`db:studio` go through `bun run:dev --`, which sources env from the Pulumi `dev` stack via `apps/infra/utils/run-command.ts` — needs the `pulumi` CLI and `PULUMI_CONFIG_PASSPHRASE` when non-interactive.
- Machine (in `apps/machine`): `bun test` (all), `bun test tests/env.test.ts` (single file), `bun test -t "name"`. Tests don't need the `msb` system runtime — sandbox tests use the mock driver (`MSB_MOCK=1`). SQLite migrations are not a script: `migrate()` in `src/utils/db.ts` runs at startup. `bun run roundtrip` = end-to-end smoke test against the web dev server (defaults to `--server http://127.0.0.1:3000`, override with the flag); `bun run build` = compiled single binary. There is no local contract-server script.
- Commits: Conventional Commits enforced by commitlint/husky; `wip` is an allowed type.

## Conventions

- Imports use explicit `.ts`/`.tsx` extensions and `verbatimModuleSyntax` is on (use `import type`). `apps/web` and `apps/infra` resolve `#/*` to `src/*`; `apps/machine` uses relative paths.
- App env vars are declared once in `apps/infra/utils/extract-env.ts`. When adding one, also update `apps/web/src/env.ts` (validation) and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*` build vars; secrets are runtime-only). Values come from Pulumi stack config; never commit `.env` files or real secrets.
- Use the domain terms from the CONTEXT docs — e.g. documents use `state`, while tasks/signals/connections use `status`; each doc has an "avoid" list.

## Known wiring drift (verify before trusting)

- `apps/infra/docker/app.ts` builds with context `apps/infra` and Dockerfile `apps/infra/Dockerfile` (which doesn't exist). The real Dockerfile is `apps/web/Dockerfile`, and it copies root-level `package.json`/`bun.lockb`/`bunfig.toml`, so it expects the repo root as build context.
- `apps/infra/utils/run-command.ts` resolves its project dir to `apps/` instead of the repo root where `Pulumi.yaml` lives (Pulumi walks up to find it, so it still works).
- `README-dev.md` tracks known ops gaps (silent backup failures, unplumbed `backup:CIPHER_PASS`, no restore tooling).
- `docs/README.md`'s drift section is itself partially stale (e.g. it says `apps/machine` imports the contract by relative path — it is a `workspace:*` dep). When docs and `package.json` manifests disagree, trust the manifests.
