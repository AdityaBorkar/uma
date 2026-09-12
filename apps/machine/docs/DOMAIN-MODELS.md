# Domain Models — uma-machine (Machine Execution context)

Single aggregate family on the device. Server owns Task lifecycle, Signal triage, Projects; here Task is an external reference (`AssignFrame.taskId`), Heartbeat is an outbound event (grill 2026-09-10).

Source anchors: `../../orpc-contract/src/` (contract), `src/sandboxes/sandbox.ts`, `src/execution/execution.ts`, `src/daemon/heartbeat.ts`, `src/utils/db.ts` + `src/schemas/db/index.ts`, `src/config/mod.ts`, `src/config/sync.ts`, `src/execution/git-binding.ts`.

## Entity

Identity by stable id, mutable lifecycle.

- **RemoteMachine** (`identity.json` via `src/enrollment/enroll.ts`): id = server `machineId` (uuid) + user-scoped `name`. Tracks `serverUrl`, `sessionToken`, `enrolledAt`.
- **Microsandbox** (`src/sandboxes/sandbox.ts`, `SandboxInfo` in `../../orpc-contract/src/schemas/primitives.ts`): id = sandbox `name` (`task-<short>-<rand>`, ≤128 UTF-8 bytes). Lifecycle `created → running → stopped → destroyed` (`stop --force` = cancel, `remove --force` = reap; no `kill`/`destroy`). SDK uses `stopWithTimeout(0)` + `remove()`; CLI uses `stop --force` / `remove --force`.
- **ProviderKey** (`provider_keys` in `src/schemas/db/index.ts`): id = `provider`. Holds `fingerprint` + `secret` + `updatedAt`.
- **ConvergenceReceipt** (`config_receipts` in `src/schemas/db/index.ts`): id = `(jobId, key, ts)`. Holds `ok` + `error`.

## Value Object

Immutable, compared by value, no lifecycle.

- **WorktreeBinding**: `(sandboxName, repoUrl, branch, commit)` tuple bound inside the sandbox (`src/execution/git-binding.ts`). Fresh-start = `clean -fdx + reset --hard <commit>`; re-clone only if `.git` corrupt.
- **HostMetrics** (`../../orpc-contract/src/schemas/primitives.ts`): `{cpu, ram, disk, pids}` with `0–100` range. `pids` is currently the agent PID allowlist only (`collectPids([process.pid])`) — sandbox PIDs are not collected yet.
- **QuotaUsage** (`../../orpc-contract/src/schemas/primitives.ts`): `{running, total}` counts derived from `listSandboxes()` via `snapshotQuota` (`src/sandboxes/sandbox.ts`).
- **LogChunk**: redacted string ≤ `LOG_FRAME_CAP_BYTES` (256KB, `../../orpc-contract/src/constants.ts`). Split via `splitChunks` in `src/execution/redact.ts`, buffered to `log_buffer` on send failure.
- **DriftReport**: `{key, drifted, detail?}` from `checkAll` (`src/config/mod.ts`).

## Aggregate

Consistency boundary; all writes go through the root.

- **Machine Convergence aggregate**: keys `programs → git-login → agents → files → providers → mcp → skills → systemd` in `ORDERED_KEYS` (`src/config/mod.ts`). `sync` = ordered `resetAll` (each key's `reset` checks internally; there is no separate check-all phase in `performSync`) + receipts (`src/config/sync.ts`).
- **Sandbox Execution aggregate**: one sandbox + its binding + its log stream + its claim for one `taskId`. Concurrent Tasks = N aggregates, bounded by quota. On success (or exec failure) the sandbox is left idle `stopped` for TTL reap; a pre-terminal failure frees it (`stop --force` + `remove --force`).

## Aggregate Root

- **RemoteMachine** is the root of Machine Convergence: owns effective limits, desired-state cache, receipts. Entry: `performSync` (CLI: persist only), `resetAll`, `handleResetConfig` (daemon: persist + `reset-ack*` + `sync-ack` when `keys:"*"`) (`src/daemon/daemon.ts`).
- **Microsandbox** is the root of Sandbox Execution: owns exec readiness gate (binding is verified before exec, after `start` — `start → ensureBinding → exec`), exec stream, stop/reap. Entry: `ExecutionEngine.executeTask`, `ExecutionEngine.cancelTask` (`src/execution/execution.ts`); admission (quota snapshot + create) and the in-flight cancel state are internal to the engine instance.

Cross-aggregate reference by id only (`taskId`, `sandboxId`, `machineId`); no object graph traversal.

## Domain Service

Stateless operations spanning entities.

- **Sandbox Execution** (`src/execution/execution.ts`): `ExecutionEngine` — `quota snapshot + Sandbox.create` under an engine-scoped admission lock (server limits from `assign.limits`) `→ claimTask → start → ensureBinding → execStream → task-done → stop`; emits every v1 frame through the `emit` passed to `executeTask` and returns a typed Execution Outcome (`completed | failed | cancelled | rejected{server|unreachable} | refused`). Any non-`ok` claim or pre-terminal failure frees the sandbox; success leaves it idle `stopped` for TTL reap. Cancel routes through in-flight state; an unconfigured agent fails closed.
- **SyncOrchestrator** (`src/config/sync.ts`, `src/daemon/daemon.ts`): ordered `resetAll`, persist-then-ack (receipts first, then per-key `reset-ack`, then `sync-ack` for `keys:"*"` on the daemon path; CLI `performSync` persists receipts only, no ws acks).
- **PressureEvaluator** (`evaluateScopeHint` in `src/daemon/heartbeat.ts`): pure and clock-free; breach = `cpu>90 || disk>90`; attributable when one sandbox `>60%` of host usage → scoped hint else `null`. Server applies sustain (10min) + cooldown (10min). `sandboxMetricsForPressure` joins `task.id`/`project.id` labels so scoped hints work when the SDK exposes metrics.
- **GitBinding** (`src/execution/git-binding.ts`): `clone --filter=blob:none` if absent else `fetch + checkout -B task/<short>` pinned to `commit`.

## Domain Event

Outbound facts, persisted before send (send failure ≠ loss).

- **Heartbeat** (`../../orpc-contract/src/schemas/machine-frames.ts`): `{machineId, cliVersion, configVersion, metrics, sandboxes, quotaUsage, scopeHint}` every 30s; SQLite-persisted first (`src/daemon/heartbeat.ts`), 30d raw retention.
- **SandboxLifecycle**: `created / running / completed|failed / stopped / destroyed` rows in `sandbox_events` (destroyed recorded on failure cleanup and reap); TTL reap age comes from the batched `lastSandboxEventTsBatch` (`src/utils/db.ts`).
- **TaskDone** (`../../orpc-contract/src/schemas/machine-frames.ts`): `{taskId, status: completed|failed, projectId}`; server enforces terminal + `finishedAt`.
- **QuotaExceeded** (`../../orpc-contract/src/schemas/machine-frames.ts` + `claim-ack ok:false`): typed `QuotaExceededError` from `quotaPreCheck`, mapped by `quotaRefusalFrames` (`src/execution/protocol.ts`); no exec, no sandbox created. The refusal `claim-ack` carries a generated placeholder id to satisfy `ClaimAckFrameSchema(min(1))`.
- **ConfigConverged**: `reset-ack` per key + `sync-ack` with `receipts[]` on the daemon `reset-config` path; desired state is cached before acks. `check-ack` exists in the contract but is never sent; buffered logs replay through `resendBufferedLogs` (peek → send → delete-through, at-least-once).

## Domain Policy

Higher-level rules with trade-offs.

- **Pressure policy**: disk>90% or cpu>90% sustained 10min → server Signal; 60% attribution decides scoped (`projectId`) vs global (`null`); 10min cooldown per scope (`../../orpc-contract/src/constants.ts`).
- **Retention policy**: `heartbeats` 30d raw + vacuum only when rows were actually deleted (steady state ≈ one vacuum at the retention boundary, no rollup v1, ~86k rows max); `sandbox_events` + `config_receipts` 90d; `log_buffer` 7d (`src/utils/db.ts`, `src/schemas/db/index.ts`).
- **Quota policy**: effective = server override ?? `limits.json` install defaults (`2×/5× GB RAM`); agent enforces locally, server wins on conflict (`src/daemon/heartbeat.ts`).
- **Secret policy**: full-keys push only; fingerprint-only check; `--secret NAME@HOST` refs only (inline `NAME=VALUE@HOST` forbidden); redaction pre-send + server second pass (`src/config/providers.ts`, `src/execution/redact.ts`).

## Specification

Boolean predicates, unit-testable.

- **QuotaSatisfied**: `running+1 <= maxRunning && total+1 <= maxTotal` else throw `QUOTA_EXCEEDED` (`src/sandboxes/sandbox.ts`).
- **SandboxNameValid**: non-empty, ≤128 UTF-8 bytes (`src/sandboxes/sandbox.ts`).
- **MachineNameValid**: slug-like lowercase `1–64` chars, not in `RESERVED_MACHINE_NAMES` (`../../orpc-contract/src/schemas/primitives.ts`, `../../orpc-contract/src/constants.ts`).
- **PressureAttributable**: top sandbox `cpu > 60% hostCpu || disk > 60% hostDisk` (`src/daemon/heartbeat.ts`).
- **LogFrameValid**: `chunk ≤ 256KB UTF-8 bytes`, `protocol:"v1"` required (`../../orpc-contract/src/schemas/machine-frames.ts`). Code splits on UTF-8 bytes (`splitChunks`); the schema enforces the same byte length via a `TextEncoder` refine.

## Factory

- **sandboxNameFor(taskId)** (`src/execution/execution.ts`): `task-<sanitized-8>-<rand6>`; guarantees uniqueness + ≤128 bytes + label-safe.
- **Sandbox builder** (`src/sandboxes/msb/sdk.ts`): `Sandbox.builder(name).image(UBUNTU_IMAGE).cpus(1).memory(1G).maxCpus(2).maxMemory(2G).label(task.id, project.id[, user.id])` + `secretEnv` refs. CLI mirror uses same image/size/`task.id`+`project.id` labels + `--secret HOSTVAR@host` (`src/sandboxes/msb/cli.ts`) but never sets `user.id`; `executeTask` never passes `userId`, so `user.id` is effectively unset on both paths today.
- **Heartbeat factory** (`buildHeartbeat` in `src/daemon/heartbeat.ts`): loads identity, collects host + SDK metrics, computes `scopeHint`, stamps `cliVersion`/`configVersion`.

## Repository

SQLite via `drizzle-orm` + `bun:sqlite` (`src/utils/db.ts` + `src/schemas/db/index.ts`), file `0600` incl `-wal`/`-shm`, cooperative single-writer (no lock — avoid concurrent daemon + CLI `sync`/`run`).

- **HeartbeatStore**: `insertHeartbeat / queryHistory / vacuumRetention / countHeartbeats`.
- **SandboxEventStore**: `recordSandboxEvent / insertSandboxEvent / lastSandboxEventTs`.
- **ReceiptStore**: `persistReceipts / persistReceiptsBestEffort / latestReceipts`.
- **ProviderKeyStore**: `setProviderKey / getProviderKeys / getProviderSecret` (secret never logged).
- **LogBuffer**: `bufferLog / peekLogBuffer / deleteLogBufferThrough / drainLogBuffer / bufferedLogCount` (rowid-ordered, at-least-once replay, 7d prune).

Schema source of truth is `src/schemas/db/index.ts` (tables) with open/migrate in `src/utils/client.ts` (`withDb` owns open/close). There are no migration files: `SCHEMA_STATEMENTS` in `src/schemas/db/index.ts` is applied additively on every writable open (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN` / `CREATE INDEX IF NOT EXISTS`) — legacy pre-drizzle `state.db` files upgrade in place, and nothing destructive is ever emitted (`migrate()` in `src/utils/db.ts` applies to a state.db manually).

## Domain Primitive

Smallest typed values with validation.

- **MachineId**: non-empty string (server uuid). **TaskId**: non-empty string. **ProjectId**: `string | null` where `null` = global Scope (`../../orpc-contract/src/schemas/server-frames.ts`).
- **ConnectionStatus**: `enrolled | connected | disconnected | revoked` (`../../orpc-contract/src/schemas/primitives.ts`); never `state`.
- **SandboxStatus**: `created | running | stopped | destroyed`; `mapStatus` in `src/sandboxes/msb/shared.ts` normalizes SDK/CLI variants.
- **CpuPct / RamPct / DiskPct**: `0–100` numbers (`HostMetricsSchema`).
- **Fingerprint**: truncated SHA-256 hex of provider secret (`src/execution/redact.ts`); stored alongside the secret, only the fingerprint is compared (`src/config/providers.ts`, `src/utils/db.ts`).
- **SecretRef**: `NAME@HOST` string; value travels in-process (SDK `secretEnv`) or resolved from host env at start (CLI), never argv/config (`src/sandboxes/sandbox.ts`).
- **Branch**: defaults `task/<short>` unless explicit; always pinned to `commit` (`../../orpc-contract/src/schemas/server-frames.ts`).

## Invariant

Must always hold; violations are bugs.

1. Strict binding: one sandbox ↔ exactly one Task ↔ exactly one Scope (null `projectId` = global encoding, not unbound). `taskId: null` in `SandboxInfo` only occurs for foreign/unlabeled sandboxes seen via list; this agent never creates them.
2. One sandbox = one Task; concurrent Tasks = N sandboxes.
3. Quota checked before `create`; over-limit `assign` refused with `QUOTA_EXCEEDED`, no exec (the unclaimed refusals send `quota-exceeded` + `claim-ack ok:false`).
4. Binding verified before exec (`start → ensureBinding → exec`); `sync`/`reset-all` never touch worktrees except explicit `--fresh-start --sandbox <id>`.
5. `state.db` (+ sidecars) and `identity.json` are `0600`; secrets never in stdout/argv/config/logs.
6. `protocol:"v1"` on every frame; unknown inbound `t` ignored; outbound unknown never sent.
7. Log chunks ≤256KB, redacted pre-send, SQLite-buffered on loss.
8. Every `reset`/`sync` yields per-key receipts (`check` yields drift reports, no receipts); daemon `reset-config` with `keys:"*"` additionally yields `sync-ack`. `check-ack` is contract-only, never sent.

## Domain Rule

Executable form of invariants (code → rule).

- R1 Cancel = `stop --force`; reap = `remove --force`; never `kill`/`destroy` (`src/sandboxes/msb/{sdk,cli,mock}.ts`).
- R2 Create-then-claim; any non-`ok` claim is authoritative → destroy unclaimed sandbox (`src/execution/execution.ts`). No explicit connected-gate — offline claim fails closed the same way.
- R3 Server `limits` override `limits.json`; agent reports `quotaUsage` every heartbeat (`src/daemon/heartbeat.ts`).
- R4 Heartbeat persist-then-send; `history` queryable after restart (`src/daemon/heartbeat.ts`, `src/daemon/daemon.ts`).
- R5 `UPGRADE_REQUIRED` on major → log + exit `3` (systemd backs off; user re-runs `install.sh`) (`src/daemon/daemon.ts`).
- R6 `prune:false` default (`performSync` forces it; `parsePruneFlag` defaults false). Refusing `reset` while a sandbox is `running` is historical plan policy (remote-machine plan §11, file no longer in tree), not implemented — `resetAll` does not inspect sandbox state today.
- R7 Sandbox names ≤128 UTF-8 bytes; machine names slug-like + not reserved (`src/sandboxes/sandbox.ts`, `../../orpc-contract/src/schemas/primitives.ts`).
- R8 No configured agent (`UMA_AGENT_BIN` or `--agent`) → Sandbox Execution fails closed (system log + `task-done failed`); the `sh` echo stub runs only when explicitly selected (`src/execution/execution.ts`).
