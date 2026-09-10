# AGENTS.md

Bun monorepo: product web app (`Planner Q3`), device agent (`uma-machine`), a frozen wire contract, and Pulumi infra. Root is dev tooling only.

## Architecture

- `apps/web` — product app: TanStack Start (React 19, file-based routes in `src/routes/`), oRPC API (`src/rpc/`, `src/routes/api/rpc.$.ts`), Drizzle/PostgreSQL schemas (`src/schemas/db/`), better-auth. Read `apps/web/docs/CONTEXT.md` (domain vocabulary with explicit "avoid" terms) and `apps/web/docs/STYLE_GUIDE.md` (Primer-style UI rules) before changing product behavior or UI.
- `apps/machine` — `uma-machine`: CLI + daemon that runs Tasks in microsandbox sandboxes (Bun + SQLite). Its server side lives in `apps/web` (`src/lib/machines/`, `device.*`/`machines.*` oRPC procedures, `/api/machines/ws` Nitro websocket). Read `apps/machine/docs/ARCHITECTURE.md` for the module/port/dependency map, plus `apps/machine/docs/CONTEXT.md` and `apps/machine/docs/DOMAIN-MODELS.md`.
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames. `apps/machine` imports it by relative path (`../orpc-contract/src/index.ts`); it must never import from `apps/machine/src`. Wire-frame changes require a major version and `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker containers + pgBackRest) and the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`. Stack `dev` skips the VM and uses local Docker; other stacks provision an OCI VM. DB backup wiring is currently commented out (`apps/infra/index.ts`; runbook in `apps/web/docs/notes/BACKUPS.md`).

## Setup

- Bun 1.4.x. The root `package.json` has no `workspaces` field: `bun install` at the root installs only root dev tooling. Install per app where you work, e.g. `cd apps/web && bun install`, `cd apps/machine && bun install`.
- `bunfig.toml` sets `minimumReleaseAge = 3 days` and `ignore-scripts = true`; don't add dependency versions published less than 3 days ago.
- Generated files are gitignored — never hand-edit: `apps/web/src/routeTree.gen.ts` (`bun run gen:routes` in `apps/web`) and `apps/web/src/schemas/db/auth.gen.ts` (`bun run gen:auth-schema`).

## Commands

From the repo root:

- `bun run check:lint` — Biome `check --fix` across the repo (format + lint + import ordering). Biome is the only formatter/linter.
- `bun run format` — Biome `format --fix`; this is what the pre-commit hook runs.
- `bun run check:types` — one `tsc --noEmit` using the root tsconfig. Apps have their own tsconfigs, so typecheck them from their own directory instead:
  - `cd apps/web && bun run check:types`
  - `cd apps/machine && bunx tsc --noEmit`
- Web (in `apps/web`): `bun run dev` / `bun run:dev -- <cmd>` is meant to inject env from the Pulumi `dev` stack (needs `PULUMI_CONFIG_PASSPHRASE` when non-interactive). `db:push` / `db:studio` are Drizzle against local Postgres and also need env; there is no committed migrations directory for web yet.
- Machine (in `apps/machine`): `bun test` (all), `bun test tests/env.test.ts` (single file), `bun test -t "name"` (matching tests). Tests don't need the `msb` system runtime — sandbox tests force the mock driver via `MSB_MOCK=1`. `bun run start` = CLI, `bun run server` = local contract server on :3030, `bun run roundtrip` = end-to-end against it, `bun run build` = compiled single binary.
- Commits: Conventional Commits enforced by commitlint/husky; `wip` is an allowed type.

## Conventions

- Imports use explicit `.ts`/`.tsx` extensions and `verbatimModuleSyntax` is on (use `import type`). `apps/web` resolves `#/*` to `src/*`; `apps/machine` uses relative paths.
- App env vars are declared once in `apps/infra/utils/extract-env.ts`. When adding one, also update `apps/web/src/env.ts` (validation) and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*` build vars; secrets are runtime-only). Values come from Pulumi stack config (`pulumi config --show-secrets`); never commit `.env` files or real secrets.
- Use the domain terms from the CONTEXT docs — e.g. documents use `state`, while tasks/signals/connections use `status`, and each doc has an "avoid" list.

## Known wiring drift

Infra was moved out of `apps/web` into `apps/infra`, and not all paths were updated. Verify before trusting these:

- `apps/web/package.json` (`run:dev`, `infra:*`) references `./infra/...`, which no longer exists; `apps/web/scripts/check-env.ts` imports `../infra/utils/extract-env.ts`; the root `check:env` and `infra:prepare` scripts reference a `scripts/` directory that does not exist.
- `apps/infra/docker/app.ts` still builds with context `apps/` and Dockerfile `apps/Dockerfile` (neither exists); the real files are `apps/web` and `apps/web/Dockerfile`.
- `README-dev.md` tracks these and other known ops gaps.
