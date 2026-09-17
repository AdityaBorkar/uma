# AGENTS.md — apps/machine (uma-machine)

Device-side single-binary agent (Bun + SQLite + microsandbox). Single bounded context (Machine Execution); the `uma` server is external upstream over the frozen `v1` contract. Read `docs/ARCHITECTURE.md` (module/port map), `docs/CONTEXT.md` (domain language + "avoid" terms), `docs/DOMAIN-MODELS.md` before changing behavior.

## Commands (run in `apps/machine`)

- `bun test` — all tests. `bun test tests/env.test.ts` — single file. `bun test -t "name"` — single test by name.
- Sandbox tests need no `msb` system runtime: they use the mock driver (`MSB_MOCK=1` / `UMA_MSB_MOCK=1`; mock paths constructor-injectable on `MsbMockDriver`).
- `bun run src/index.ts <cmd>` — run the CLI without building (`enroll|daemon|check|reset|sync|history|sandbox|run|version`).
- `bun run dev` — same as above via script alias.
- `bun run roundtrip` — end-to-end smoke test vs the web dev server (default `--server http://127.0.0.1:3000`).
- `bun run build` — compiled single binary → `.output/uma-machine`.
- `bun run docs:wire` — regenerate `docs/wire-schema.json` from the frozen contract (never hand-edit).
- Typecheck: `bunx tsc --noEmit` (in this dir). Lint/format from root: `bun run check:lint` / `bun run format`.

## Conventions

- Relative imports only, explicit `.ts` extensions, `import type` for types. No `#/*` alias here (that is web/infra only). Never import from `apps/web` or other consumer apps — only `@uma/orpc-contract` (workspace dep) plus npm/catalog deps.
- Allowed dependency direction (`docs/ARCHITECTURE.md` §Dependency): `orpc-contract` never imports from `src/`; `db` never imports drivers; drivers never import `execution`. Keep it acyclic.
- Env access via `src/utils/env.ts` helpers (`configDir()`, `dataDir()`, `serverUrl()`, `heartbeatIntervalS()`, `daemonIntervalS()`, `parseOnlyFlag()`, …). `UMA_*` overrides win; computed per-access (not module load) so tests can override. Coerce with `z.coerce.*.catch(fallback)`, never bare `Number()`/`parseInt` without a floor.
- Validation with Zod at trust boundaries: inbound ws frames via `parseServerFrame` (unknown `t` → `null`, logged + ignored), every outbound `send` via `assertMachineFrame`; `identity.json`/`limits.json`, machine names, `--only` lists.
- Exit codes are the CLI contract: `0` ok, `2` drifted/partial, `1` error, `3` upgrade-required. `--json` prints machine-readable JSON; human tables via `cli-table3` gated on `pc.isColorSupported` (see `humanTable()` in `src/index.ts`).
- Secrets: `Redactor` seeded with session token + provider secrets + `GH_TOKEN`/`GITHUB_TOKEN`, plus generic patterns. Redact before logging (`safeError(...).slice(0, 300)`); `redactObject` fails closed (buffer/drop, never send unredacted). `chmod0600` on `identity.json`, `state.db` + sidecars.
- SQLite (`src/utils/db.ts`, `src/utils/client.ts`, `src/schemas/db/`): additive DDL only (`CREATE TABLE/INDEX IF NOT EXISTS` + `ADD COLUMN`), `PRAGMA user_version` mirrors `SCHEMA_VERSION`, WAL mode, `migrate()` runs at startup (there is no migration script).
- DI without a framework: function-arg injection (`executeTask(assign, { emit, claim?, agentBin? })`, `connectWithBackoff(handlers, { shouldStop, … })`). Tests inject `emit`/`claim` and use the mock driver. `evaluateScopeHint` is pure/clock-free; `resolveLimits` is the single quota resolver (server > file > default).
- Contract freeze (`apps/orpc-contract/docs/VERSIONING.md`): frame names, required fields, validation semantics, and constants are frozen. Safe = new optional field or ignorable new `t` (minor). Renames/removals/required-tightening = major + `UPGRADE_REQUIRED` handling (exit `3`), regenerate `docs/wire-schema.json`, update the Contract section of `ARCHITECTURE.md`.
- Tests (`bun:test`): save/restore mutated env keys in `afterEach` (see `tests/env.test.ts`); use constructor-injected temp paths, never real `~/.config`. `DriverSelector` probes are sticky instance state — fresh selector or `reset()` in tests.
- Domain terms: Microsandbox (not container/VM), Worktree Binding (not checkout), Sandbox Execution, Execution Outcome (`completed|failed|cancelled|rejected|refused`), Check/Reset State, State Sync (`performSync`), Convergence Receipt (stored row) vs ack (wire frame), Quota (code name `Limits`). Tasks are server-owned references (`taskId` only) — never a Task lifecycle here.
