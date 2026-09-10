# ARCHITECTURE — uma-machine

Device-side single-binary agent (Bun + SQLite + microsandbox). Single bounded context (Machine Execution); server is external upstream over frozen `v1` contract.

## Module

`src/` ownership:

- `index.ts`: CLI dispatcher (composition root edge) + exit codes. `cli.ts`: arg parsing + help text.
- `daemon.ts`: tick loop + ws dispatch (assign/cancel/reset-config) + TTL reap. `ws-client.ts`: reconnecting ws.
- `enroll.ts`: device flow + `identity.json` + `limits.json` + SQLite init + systemd writer (Ubuntu pre-pull lives in `install.sh` + `programs` reset best-effort, not here).
- `heartbeat.ts`: host (`/proc`, `df`) + SDK collectors + `scopeHint` + persist-then-send + `history` query.
- `sandbox.ts`: facade over `sandbox/driver.ts` (SDK → CLI → mock; fails closed when no runtime is installed) + `sandbox/sdk.ts`, `sandbox/cli.ts`, `sandbox/mock.ts`, `sandbox/shared.ts`, `sandbox/types.ts`, `sandbox/driver.ts` (selector + `driverKind` diagnostics); create/start/stop/remove/list/exec/execStream/metrics. `git-binding.ts`: clone/fetch/checkout/fresh-start via `execInSandbox` (driver-agnostic, not SDK-only).
- `execution.ts`: Sandbox Execution module: admission (quota snapshot + create under an internal lock; server limits from `assign.limits`) → claim → start → bind → exec-stream → task-done → stop; every outbound v1 frame via injected `emit`; failures free the sandbox; cancel via `stop --force` through in-flight state.
- `sync.ts` + `config/mod.ts` + `config/desired.ts` (desired-state cache load/save) + `config/<key>.ts` (9 keys in `ORDERED_KEYS` order; file `git.ts` exports KEY `git-login`, file `skills.ts` exports KEY `skills`): check/reset + receipts.
- `db.ts` (store facade) + `db/schema.ts` (tables) + `db/client.ts` (open/migrate/WAL): SQLite stores + retention. `redact.ts`: secrets + 256KB split. `env.ts`: XDG + `UMA_*` resolution. `protocol.ts`: re-export of `orpc-contract` + validated frame/refusal helpers. `proc.ts`: process runner (`runCapture`/`whichBin`). `limits.ts`: single quota resolver. `version.ts`: `CLI_VERSION`/`CONFIG_VERSION`. `fs-utils.ts`: `chmod0600`, parent-dir helpers.

## Package

- Runtime deps (`package.json`): `zod` (validation), `microsandbox` SDK (in-process sandbox API), plus CLI/store/util deps (`cac`, `cli-table3`, `drizzle-orm`, `env-paths`, `es-toolkit`, `fast-redact`, `ms`, `nanoid`, `p-retry`, `picocolors`, `semver`, `write-file-atomic`, `zod-validation-error`; `drizzle-kit` is currently listed under dependencies but used as a dev tool). Dev: `@types/*`, `typescript`, `zod-to-json-schema`.
- System packages (never bundled): `msb` runtime via `install.sh` (`install.microsandbox.dev` / brew, resolved via `MSB_PATH`/`UMA_MSB_BIN`), pinned `UBUNTU_IMAGE=docker.io/library/ubuntu:24.04` (`orpc-contract/src/constants.ts`), fixed `1c/1G` + `2x` max.
- Local package: `orpc-contract/` (frozen v1: `index.ts` barrel + `constants.ts`, `primitives.ts`, `machine-frames.ts`, `server-frames.ts`, `orpc.ts`, `utils.ts`). `server-central/` is dev/staging harness only.

## Component

Runtime pieces and their processes:

- **CLI**: one-shot commands `enroll|daemon|check|reset|sync|history|sandbox|run|version` (`src/index.ts`, `src/cli.ts`). Exit `0` ok, `2` drifted/partial, `1` error, `3` upgrade-required.
- **Daemon**: `runDaemon` (`src/daemon.ts`): heartbeat tick (default 30s) + ws loop; assigns delegate to `executeTask`, cancels to `cancelTask`; opportunistic reap of `stopped` older than `UMA_SANDBOX_TTL_S` (1h).
- **WsClient**: one ws per machine, Bearer auth, jittered backoff (`src/ws-client.ts`), logical `heartbeat|claim|logs|config` channels multiplexed as v1 JSON frames (no explicit channel field on the wire).
- **HeartbeatCollector**: `collectHostMetrics` + `listSandboxes` + `sandboxMetricsForPressure` → `buildHeartbeat` → `persistHeartbeat`.
- **SandboxDrivers**: `driver()` selects `sdk` → `cli` → fail closed (`src/sandbox/driver.ts`); mock only when `MSB_MOCK`/`UMA_MSB_MOCK` is set, file-backed (`mock-sandboxes.json` + `msb-root-meta/<name>/meta.json` under `dataDir`, tests/dev). SDK = streaming + `secretEnv`; CLI = `msb create/start/stop --force/remove --force/exec`. True streaming is SDK-only; CLI/mock funnel through capture.
- **ConfigConvergers**: 9 `KeyModule {KEY, check, reset}` run in `ORDERED_KEYS` order; `resolveKeys(--only)` filters (alias `"sync"` → `"skills"`); `desired.json` corruption is reported as drift, not silently defaulted.

## Service

Two senses, kept distinct:

- Domain services: `executeTask`, `performSync`, `evaluateScopeHint`, `ensureBinding` (see `DOMAIN-MODELS.md#domain-service`).
- OS service: `uma-machine.service` user unit (`Restart=always`, `WantedBy=default.target`) + `loginctl enable-linger` owned by check/reset/sync (`src/config/systemd.ts`). Logs to journald; foreground `daemon` for dev.

## Dependency

Allowed direction (no cycles):

`index → cli, daemon, enroll, execution, heartbeat, sandbox, sync, env, git-binding`
`daemon → ws-client, heartbeat, execution, sandbox, db, enroll, env, config/mod, config/desired, redact, version`
`execution → sandbox, git-binding, limits, db, redact, enroll, env, config/providers, protocol`
`heartbeat → sandbox(list/metrics), db, enroll, env, proc, version`
`config/* → desired, db, env, proc, fs-utils`; `config/mod → 9 keys`; `config/providers → db, redact`
`all → orpc-contract` (contract has zero deps on `src/`); `sandbox → env, proc, sandbox/*`; `limits → enroll + orpc-contract`
`db → drizzle-orm/bun-sqlite` + `node:fs/path` only; `ws-client → enroll(identity) + orpc-contract` only.

Rule: `orpc-contract` never imports from `src/`; `db` never imports drivers; drivers never import `execution`.

## Port

Inbound (driven by outside):

- CLI port: `parseCli` commands (human + scripts).
- Server-frame port: `handleFrame` in `src/daemon.ts` handling `assign|cancel|reset-config|UPGRADE_REQUIRED`; assigns are serialized through an admission lock.

Outbound (driven by us, faked in tests):

- Server port: ws frames + `POST /rpc/tasks.claim` (`claimTask` in `src/execution.ts`, injectable via `ExecutionDeps.claim`; non-ok frees the sandbox).
- Sandbox port: `createSandbox/startSandbox/stopSandbox/removeSandbox/listSandboxes/snapshotQuota/execInSandbox/execStreamInSandbox/sandboxMetricsForPressure` (`src/sandbox.ts`, backed by the `SandboxDriver` port).
- Store port: `withDb` + `insert*/query*/persist*/record*` (`src/db.ts`, `src/db/client.ts`, `src/db/schema.ts`).
- Clock/Random port: `Date.now()`, `customAlphabet` (names), `setInterval` (tick); `evaluateScopeHint` is pure and clock-free (server owns sustain/cooldown).
- Platform port: `runCapture` (process spawn), `/proc` + `df` (metrics), `loginctl/systemctl` (systemd).

## Adapter

- **Server adapter**: `ws-client.ts` (ws transport) + `daemon.ts:handleResetConfig` (receipt mapping) + `execution.ts:claimTask` (HTTPS claim, default claim for `executeTask`).
- **Sandbox adapters**: `src/sandbox/sdk.ts`, `src/sandbox/cli.ts`, `src/sandbox/mock.ts` implement the same `SandboxDriver` port (`create/start/stop/remove/list/exec/execStream/metrics`); `task.id`/`project.id` labels set on SDK + CLI create (`user.id` never set — `executeTask` passes no userId).
- **Store adapter**: `db.ts` + `db/schema.ts` + `db/client.ts` over `drizzle-orm` + `bun:sqlite` (WAL, `0600` incl sidecars, `withDb` open/close, `drizzle/` migrations when present).
- **Metrics adapters**: `collectCpu/collectRam/collectDisk` (Linux-first, degrade to `0`), `sandboxMetricsForPressure` (SDK-only, `[]` when absent).
- **Config adapters**: per-key `check/reset` shell-outs (`msb doctor`, `gh auth status`, `loginctl show-user`, binary `--version`).

## Interface

- TS types: `CreateOpts {name, taskId, projectId, secrets[] {guestVar, hostVar, value, hosts}}`, `ExecResult {code, stdout, stderr}`, `ExecutionDeps {emit, claim?, agentBin?}`, `ExecutionOutcome` (union `completed | failed | cancelled | rejected{server|unreachable} | refused`), `WsHandlers {onFrame, onOpen, onClose, onError}`, `CheckResult {key, drifted, detail?}`, `ResetResult {key, ok, error?, changed?}`.
- Runtime interfaces: Zod schemas `LimitsSchema`, `QuotaUsageSchema`, `HostMetricsSchema`, `SandboxInfoSchema`, `MachineFrameSchema` (enforced by `ws-client.send` via `assertMachineFrame`), `ServerFrameSchema` (inbound `parseServerFrame`, unknown `t` → `null`).
- Sandbox driver interface: `SandboxDriver` port (`create/start/stop/remove/list/exec/execStream/metrics`) implemented by SDK/CLI/mock so `execution` never branches; `driverKind()` is diagnostics-only and `driver()` fails closed when no runtime is installed.

## Contract

- Frozen `v1` (`PROTOCOL_VERSION` in `orpc-contract/src/constants.ts`): machine→server `heartbeat|log|task-done|check-ack|reset-ack|sync-ack|claim-ack|quota-exceeded`; server→machine `assign|cancel|reset-config|UPGRADE_REQUIRED`. Change needs major + `UPGRADE_REQUIRED` handling. Full catalog in `apps/orpc-contract/docs/FRAMES.md`; versioning runbook in `apps/orpc-contract/docs/VERSIONING.md`.
- Key clauses: `protocol:"v1"` required; unknown `t` ignored; `projectId null` = global; branch `task/<short>` + commit pin; 256KB log cap; per-key receipts + `sync-ack`; server `limits` override; `QUOTA_EXCEEDED` refusal shape.
- HTTPS: `tasks.claim` atomic (`UPDATE … WHERE status='queued'` server-side; `res.ok` decides here).
- CLI UX: tables + `--json`, `--only`, `--dry-run`, `--prune` (default false), exit codes above; `history [--range 24h|30d]` reads 30d raw.

## Protocol

Wire detail (`src/ws-client.ts`, `orpc-contract/src/*-frames.ts`):

1. `enroll` → `device.code` → print `user_code + verification_uri` → poll `device.token` (`authorization_pending/slow_down/expired_token/access_denied`) → store Bearer `0600`.
2. `daemon` opens `ws(s)://<server>/api/machines/ws` with `authorization: Bearer <token>`; jittered backoff reconnect; heartbeat 30s with `quotaUsage + scopeHint`.
3. Server sends `assign{taskId, projectId|null, repoUrl, branch, prompt, limits?, commit?, freshStart?}` → client `quotaPreCheck` → `create → claim-ack → start → ensureBinding → execStream(redacted, 256KB, buffered) → task-done{projectId} → stop` (idle `stopped` left for TTL reap; never removed in `executeTask`).
4. `cancel{taskId}` → `stop --force`; `reset-config{keys|"*", version, payload}` → `resetAll` → `reset-ack*` (+ `sync-ack` when `*`); `UPGRADE_REQUIRED{minVersion}` → exit `3`.

## Boundary

- Repo: `uma-machine` (device executor) vs `uma` (server DB/oRPC/web). Only shared code is the versioned `orpc-contract` shape mirror.
- Process: `bun build --compile src/index.ts --outfile .output/uma-machine` single binary (`package.json:build`); SDK path needs Node22 natives (Phase-0 gate), CLI fallback covers compiled binary (ADR-0003).
- Trust: TLS + Bearer + pre-bound `user_id` + `validateClient` allowlist (server-side); `0600` storage + `--secret` refs + dual redaction here. Revoke = session revoke → ws rejected.
- Filesystem: full XDG (`configDir/dataDir/identityPath/limitsPath/stateDbPath` in `src/env.ts`; host `~/` only via `homedir()` fallback, never hardcoded); `msb` root owned by runtime under `~/.microsandbox/`, meta under `dataDir/msb-root-meta/`.
- Isolation: Tasks only inside `msb` (pinned Ubuntu); no host fallback; `sync` never touches worktrees. Per-Task `--net/--no-net` (default deny) is plan policy, not implemented in code — no net flags are passed at create today.

## Composition Root

`src/index.ts:main()` (CLI) + `runDaemon()` (long-lived). Manual wiring, no container:

- `main` parses args → calls `enroll / runDaemon / checkAll / resetAll (+ freshStart) / performSync / readHistory / listSandboxes (+ prune via removeSandbox) / executeTask` with explicit args.
- `runDaemon` loads `identity`, computes `intervalS`, wires `handleFrame(send)` closures, starts tick + `connectWithBackoff`. Single-writer is cooperative (no lock): daemon tick writes heartbeats/receipts/events; CLI `sync`/`run` also write when invoked — avoid running them concurrently with the daemon.

## Dependency Injection

No framework. Function-arg injection throughout:

- `executeTask(assign, {emit, claim?, agentBin?})` — admission lock, in-flight cancel state, and refusal frames live inside the module; tests inject `emit` + `claim` and use the mock driver.
- `connectWithBackoff(handlers, {shouldStop, url, maxBackoffMs})` — tests inject `shouldStop`.
- `performSync({dryRun, only, jobId, payload})` (always `prune:false`; `dryRun` previews without persisting), `resetAll({only, dryRun, payload})`, `evaluateScopeHint(cpu, disk, metrics)` (pure, clock-free; sustain lives server-side), `resolveLimits(serverOverride)` (server > file > default).
- `driver()` fails closed when no SDK/CLI runtime is installed; `useMock()` is opt-in via `MSB_MOCK`/`UMA_MSB_MOCK`.
- Env access lives in `env.ts` helpers, but is not exclusive: `sandbox/mock.ts` reads `MSB_MOCK`/`UMA_MSB_MOCK`, `execution.ts` reads `GH_TOKEN`/`GITHUB_TOKEN` + `UMA_AGENT_BIN`, `systemd.ts` reads `USER`/`LOGNAME`/`UMA_SYSTEMD_UNIT`/`UMA_EXEC_PATH`/`XDG_CONFIG_HOME`, `enroll.ts` reads `UMA_RAM_GB`. Secrets passthrough (`exportProviderEnv`, `MSB_PATH`) intentionally bypasses `env.ts`.

## Configuration

- Files: `identity.json {machineId, serverUrl, sessionToken 0600, enrolledAt, machineName?}`, `limits.json {ramGB, maxRunning, maxTotal, computedAt, source:"install-probe"}` (`2×/5×` GB, floor 1), `state.db` (SQLite), desired cache (`desired.json` via `loadDesired/saveDesired` in `src/config/desired.ts`: `version` + `templates`/`limits`/`programs`/`providers`/`agents`/`mcp`/`skills`).
- Env (`src/env.ts` + call sites): `UMA_SERVER_URL` (+ `UMA_SERVER` fallback), `UMA_TOKEN_FILE`, `UMA_MACHINE_ROOT`, `UMA_CONFIG_HOME`/`UMA_DATA_HOME` (full-dir overrides) vs `XDG_CONFIG_HOME`/`XDG_DATA_HOME` (base), `UMA_HEARTBEAT_INTERVAL_S` (≥5, default 30; daemon `--interval` floor is 2s via `daemonIntervalS`), `UMA_HEARTBEAT_RETENTION_DAYS` (≥1, default 30), `UMA_STATE_DB`, `UMA_MSB_BIN`/`MSB_PATH`, `UMA_SANDBOX_TTL_S` (≥60, default 3600), `UMA_AGENT_BIN`, plus `UMA_RAM_GB` (enroll probe fallback), `UMA_MSB_MOCK`/`MSB_MOCK`, `UMA_HOME` (files/skills), `UMA_ADITYAB_AGENT_PIN`, `UMA_EXEC_PATH`/`UMA_SYSTEMD_UNIT` (systemd), `GH_TOKEN`/`GITHUB_TOKEN` (redaction).
- Precedence: server `limits` (assign/reset-config) > `limits.json` > hardcoded `8/20` fallback — single resolver in `src/limits.ts` (`resolveLimits`, with `source` provenance).

## Cross-cutting Concern

- Redaction: `Redactor` (`src/redact.ts`) seeded with session token + provider secrets + `GH_TOKEN`/`GITHUB_TOKEN`, plus generic secret patterns; applied to log chunks pre-send (buffered chunks are already redacted); `redactObject` fails closed (buffers rather than sends unredacted); `log_buffer` treated as sensitive.
- Permissions: `chmod0600` on `identity.json`, `state.db` + `-wal/-shm/-journal` (`src/fs-utils.ts`, `src/db/client.ts`).
- Validation: Zod at trust boundaries (`identity.json`/`limits.json`, ws frames, machine-name, `--only` parsing); `parseServerFrame` enforced inbound, `assertMachineFrame` enforced on every outbound `send`; declared template/skill names are allowlisted against path traversal.
- Observability: `cliVersion` + `configVersion` every heartbeat; `history` command; `sandbox_events` + `config_receipts` audit; `journald` when under systemd.
- Resilience: persist-then-send for heartbeats/receipts/logs; `persistReceiptsBestEffort` never masks converge; per-key try/catch in `checkAll/resetAll`; `send` failures isolated per frame; jittered backoff; `pruneAuxTables` best-effort.
- Retention: 30d heartbeats + vacuum only when deletes (`src/db.ts`), 90d events/receipts, 7d log buffer (`src/db.ts` + `pruneAuxTables`).
- Docs generation: `docs/wire-schema.json` is generated from the frozen contract (`bun run docs:wire` → `scripts/generate-wire-schema.ts`). Do not edit by hand.
