# AGENTS.md — apps/server (control plane)

Bun control-plane server (`Bun.serve`): oRPC API (`/api/rpc`, `/api/openapi`),
better-auth (`/api/auth/*`), machine wire (`/api/machines/*` + WS
`/api/machines/ws`), OAuth callbacks (`/api/connections/*`), debug/seed
helpers (`/api/debug/*`, `E2E_SEED`-gated), and utility endpoints
(`/api/mcp/versions`, `/api/skills/verify`, `/api/model-providers/detect`).
Owns Drizzle/PostgreSQL schemas (`src/db/`, snake_case columns ↔ camelCase
fields). Product language in `apps/web/docs/CONTEXT.md`; wire freeze in
`apps/orpc-contract/docs/`.

## Commands (run in `apps/server`)

- `bun run dev` — control plane with local env (or `bun run:dev -- bun run src/index.ts` for Pulumi `dev`-stack env; needs `pulumi` CLI + `PULUMI_CONFIG_PASSPHRASE` non-interactive).
- `bun run:dev -- <cmd>` — run any command with `dev`-stack env (e.g. `bun run:dev -- drizzle-kit push`).
- `bun run db:push` / `bun run db:studio` — push schema / open Drizzle Studio (both via `run:dev`).
- `bun run gen:auth-schema` — regenerate `src/db/auth.gen.ts` (via `run:dev`; never hand-edit).
- Typecheck: `bunx tsc --noEmit` (in this dir). Lint/format from repo root: `bun run check:lint` / `bun run format`.
- No unit tests here — verify with `tsc --noEmit`; end-to-end via `bun run roundtrip` in `apps/machine` against this server (`--server http://127.0.0.1:4000`).

## Conventions

- Imports use relative paths with explicit `.ts` extensions, `import type` for types (`verbatimModuleSyntax`). There is no `#/*` alias in this app (that is web-only) — Bun resolves relative imports with no build step. Never import from `apps/web`.
- API: contract-first — `implementer` from `#/rpc/contract.ts` (backed by `@uma/orpc-contract`); older namespaces share the same contract schemas through the `authed` base (cookie auth, injects `user`) migrating incrementally. Procedures live in `src/rpc/procedures/` (export names match the contract namespace 1:1, mounted directly in `src/rpc/router.ts`), guards in `src/rpc/auth.ts` (`authed`, `requireUser`, `requireMachine`) and `src/rpc/scope.ts` (`mustReturn`, `zeroFilledCounts`, `isUniqueViolation` → `CONFLICT`, slug + cursor pagination).
- Errors: `throw new ORPCError("<CODE>", { message })`; contract-first handlers use `throw errors.*()` where the contract declares the error.
- DB: Drizzle schemas in `src/db/` (pgEnums derive from the `*_VALUES` tuples in `src/schemas/`, `CHECK`s for invariants); Zod inputs in `src/schemas/` (per-domain modules, `schema.ts` barrel). Every query filters by `userId`; child rows checked via parent ownership; updates/deletes carry the owner predicate in `WHERE` (guarded writes throw `CONFLICT` on concurrent miss). Server stamps lifecycle timestamps — never accept client timestamps.
- Env: validated in `src/env.ts` (`@t3-oss/env-core`); everything runtime-only (no build args). New vars must also be added to `apps/infra/utils/extract-env.ts` manifest. `PUBLIC_WEB_*` mirror the web origin for public URL construction (OAuth `redirect_uri`, device `verification_uri`) and CORS allowlist — they are not secrets.
- WS (`/api/machines/ws`): raw JSON v1 frames per the frozen contract (not oRPC envelope); auth is machine Bearer via `bearerToken(request)` (header or `?token=`); unknown/invalid `t` ignored, never throws. Single-process socket registry in `src/machines/sockets.ts` (dead-peer eviction, no backpressure) — fan-out moves to Redis pub/sub past one replica.
- Machines domain (`src/machines/`): `auth.ts` (Bearer + session join), `device.ts` (enrollment flow), `heartbeat.ts` (presence writes/reads), `tasks.ts` (claim/log/finish), `sockets.ts` (registry), `service.ts` (re-export facade + reset fan-out/health). Import from leaf modules directly.
- Strict TS applies (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`).
