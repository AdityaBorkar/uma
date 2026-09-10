# Uma monorepo

Bun monorepo: product web app, device agent, frozen wire contract, and Pulumi infra. Root is dev tooling only.

## Map

- `apps/web` — product app: TanStack Start (React 19, file-based routes in `src/routes/`), oRPC API (`src/rpc/`, `src/routes/api/rpc.$.ts`), Drizzle/PostgreSQL schemas (`src/schemas/db/`), better-auth. Product language in `apps/web/docs/CONTEXT.md`; UI rules in `apps/web/docs/STYLE_GUIDE.md`; decisions in `apps/web/docs/adr/`.
- `apps/machine` — `uma-machine`: CLI + daemon that runs Tasks in microsandbox sandboxes (Bun + SQLite). Module/port map in `apps/machine/docs/ARCHITECTURE.md`; domain language in `apps/machine/docs/CONTEXT.md`; entities in `apps/machine/docs/DOMAIN-MODELS.md`; wire snapshot in `apps/machine/docs/wire-schema.json` (generated via `bun run docs:wire`).
- `apps/orpc-contract` — frozen `v1` machine↔server wire frames. `apps/machine` imports it by relative path (`../orpc-contract/src/index.ts`); it never imports from `apps/machine/src`. Policy and frame catalog in `apps/orpc-contract/docs/`. Wire-frame changes require a major version and `UPGRADE_REQUIRED` handling.
- `apps/infra` — Pulumi program (OCI VM + Cloudflare DNS + Docker containers + pgBackRest) and the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`. Stack `dev` skips the VM and uses local Docker; other stacks provision an OCI VM.
- `docs/do-not-touch-ai/` — frozen product theory (`PRINCIPLES.md`, `REFERENCE.md`) and backup runbook (`BACKUPS.md`). Do not restructure; `REFERENCE.md` links assume a pre-move layout (`src/lib/*`, `infra/*`) and are aspirational for future engines.

## Context map

Two bounded contexts, one contract:

- **Planner Q3 (apps/web)** owns Projects, Documents, Signals, Tasks, Connections. Upstream for Tasks/Signals consumed by devices.
- **Machine Execution (apps/machine, downstream / conformist)** owns enrollment, heartbeat, sandbox lifecycle, task execution. Conforms to the frozen `v1` contract; server wins on conflict (`assign.limits`, `reset-config`, `tasks.claim` 409, `UPGRADE_REQUIRED` on major).

## Env / infra pointers

- App env vars are declared once in `apps/infra/utils/extract-env.ts`. When adding one, also update `apps/web/src/env.ts` (validation) and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*` build vars; secrets are runtime-only). Values come from Pulumi stack config; never commit `.env` files or real secrets.
- DB backup wiring is currently commented out in `apps/infra/index.ts`; runbook in `docs/do-not-touch-ai/BACKUPS.md`, decision in `apps/web/docs/adr/007-postgresql-backups.md`.

## Known wiring drift (verify before trusting)

Infra was moved out of `apps/web` into `apps/infra`, and not all paths were updated:

- `apps/web/package.json` (`run:dev`) references `infra/utils/run-command.ts`, which no longer exists under `apps/web/`; `apps/web/scripts/check-env.ts` imports `../infra/utils/extract-env.ts`; the real manifest lives at `apps/infra/utils/extract-env.ts`.
- `apps/infra/docker/app.ts` still builds with context `apps/` and Dockerfile `apps/Dockerfile` (neither exists); the real files are `apps/web` and `apps/web/Dockerfile`.
- `apps/infra/utils/run-command.ts` resolves the project dir to `apps/` instead of the repo root where `Pulumi.yaml` lives.
- Web ADRs 006/007 and `docs/do-not-touch-ai/*` still cite pre-move `infra/*` paths; ADRs note the delta inline.
