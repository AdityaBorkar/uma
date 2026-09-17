# Uma monorepo

Bun monorepo: product web app, device agent, frozen wire contract, and Pulumi infra. Root is dev tooling only.

## Map

- `apps/web` — product app: TanStack Start (React 19, file-based routes in `src/routes/`), oRPC API (`src/rpc/`, `src/routes/api/rpc.$.ts`), Drizzle/PostgreSQL schemas (`src/schemas/db/`), better-auth. Product language in `apps/web/docs/CONTEXT.md`; UI rules in `apps/web/docs/STYLE_GUIDE.md`; decisions in `apps/web/docs/adr/`.
- `apps/machine` — `uma-machine`: CLI + daemon that runs Tasks in microsandbox sandboxes (Bun + SQLite). Module/port map in `apps/machine/docs/ARCHITECTURE.md`; domain language in `apps/machine/docs/CONTEXT.md`; entities in `apps/machine/docs/DOMAIN-MODELS.md`; wire snapshot in `apps/machine/docs/wire-schema.json` (generated via `bun run docs:wire`).
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames. Both `apps/machine` and `apps/web` import it as `@uma/orpc-contract` (workspace dep: `apps/machine/package.json:18`, `apps/web/package.json:51`); it never imports from `apps/machine/src`. Policy and frame catalog in `apps/orpc-contract/docs/`. Wire-frame changes require a major version and `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker containers + pgBackRest) and the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`. Stack `dev` skips the VM and uses local Docker; other stacks provision an OCI VM.
- `docs/do-not-touch-ai/` — frozen product theory (`PRINCIPLES.md`, `REFERENCE.md`) and backup runbook (`BACKUPS.md`). Do not restructure; `REFERENCE.md` links assume a pre-move layout (`src/lib/*`, `infra/*`) and are aspirational for future engines.
- `apps/cli` — `uma` repo CLI + docs MCP server (`uma mcp start`, `uma docs list|read|query`, `uma version`). Tools `read_docs` / `query_docs` serve all repo markdown; see `apps/cli/README.md`.

## Context map

Two bounded contexts, one contract:

- **Planner Q3 (apps/web)** owns Projects, Documents, Tasks, Connections. Upstream for Tasks consumed by devices.
- **Machine Execution (apps/machine, downstream / conformist)** owns enrollment, heartbeat, sandbox lifecycle, task execution. Conforms to the frozen `v1` contract; server wins on conflict (`assign.limits`, `reset-config`, `tasks.claim` 409, `UPGRADE_REQUIRED` on major).

## Env / infra pointers

- App env vars are declared once in `apps/infra/utils/extract-env.ts`. When adding one, also update `apps/web/src/env.ts` (validation) and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*` build vars; secrets are runtime-only). Values come from Pulumi stack config; never commit `.env` files or real secrets.
- DB backup wiring is currently commented out in `apps/infra/index.ts`; runbook in `docs/do-not-touch-ai/BACKUPS.md`, decision in `apps/web/docs/adr/007-postgresql-backups.md`.

## Known wiring drift (verify before trusting)

Infra was moved out of `apps/web` into `apps/infra`; the path fallout is
fixed: `apps/infra/docker/app.ts` builds from the repo-root context with
`apps/web/Dockerfile`, `apps/infra/utils/run-command.ts` resolves the repo
root where `Pulumi.yaml` lives, and `bun run check:env` in `apps/web`
(`scripts/check-env.ts`) verifies the `APP_ENV_VARS` manifest against the
Dockerfile `ARG` block and `apps/web/src/env.ts`.
`docs/do-not-touch-ai/REFERENCE.md` links still assume the pre-move layout
(`src/lib/*`, `infra/*`) and are aspirational for future engines (frozen —
do not restructure).
