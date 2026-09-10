# uma-machine

Device-side agent that lets a user-owned machine run Tasks on the user's behalf.

## Bounded Contexts

Single bounded context: **Machine Execution**. This repo owns enrollment, heartbeat, state convergence, sandbox lifecycle, and task execution on the device.

The `uma` server (Tasks, Signals, Projects, machine registry) is an external upstream system, not a bounded context owned here. This repo conforms to its `v1` contract via `@uma/orpc-contract` (`../orpc-contract/`).

## Context Map

- **Machine Execution (this repo, downstream / conformist)** → **uma Server (external upstream, sole owner)**:
  Consumes `machines.*` + `/api/machines/ws` as frozen `v1` JSON frames (`../orpc-contract/src/schemas/machine-frames.ts`, `../orpc-contract/src/schemas/server-frames.ts`).
  ACL = `src/ws-client.ts` + `parseServerFrame` / `validateMachineFrame` (unknown `t` logged + ignored, never sent).
- Server wins on conflict: `assign.limits` / `reset-config` override local `limits.json`; `tasks.claim` `409` is authoritative; `UPGRADE_REQUIRED` on major forces reinstall.

## Language

### Identity and connection

**Remote Machine**:
A user-owned device enrolled to run Tasks.
_Avoid_: worker, node, runner

**Connection State**:
Whether a machine is enrolled, connected, disconnected, or revoked.
_Avoid_: state

**Heartbeat**:
A periodic machine-to-server ping carrying host and sandbox health.
_Avoid_: poll, ping

**Task Reference**:
An external Task identifier owned by the server; this context stores only `taskId` plus `AssignFrame` fields, never Task lifecycle.
_Avoid_: task entity, job

### Execution

**Microsandbox**:
An isolated execution environment bound to exactly one Task and one Project Scope.
_Avoid_: container, VM, job

**Worktree Binding**:
The sandbox, repository, branch, and commit a Task runs in (machine is implied by identity; `BindingOpts` also carries `taskId` + `defaultBranch`).
_Avoid_: checkout, workspace (the git verb `checkout -B` inside `git-binding.ts` is fine; the term for the tuple is Worktree Binding)

**Sandbox Execution**:
The lifecycle of one Microsandbox for one Task — admission, create, claim, start, Worktree Binding, exec, terminal outcome, stop or cleanup — owned as one unit, including its cancellation.
_Avoid_: task runner, job runner

**Execution Outcome**:
The terminal state of a Sandbox Execution: `completed`, `failed`, `cancelled`, `rejected` (the server refused the claim), or `refused` (Quota).
_Avoid_: run result, exit status

**Signal Scope**:
Whether a machine-originated Signal belongs to one Project or is global.
_Avoid_: alert target

**Provider Key**:
Long-lived secret material stored locally in SQLite and injected at run time via `--secret` refs, never compared or logged by value.
_Avoid_: api key blob, env secret

### Convergence and limits

**Desired State**:
The server-declared configuration a machine must converge to.
_Avoid_: config blob, properties

**Check State**:
A read-only comparison of actual versus desired configuration.
_Avoid_: dry run ( `--dry-run` is a reset/sync preview flag, not a Check State)

**Reset State**:
Idempotent convergence of actual configuration toward desired configuration.
_Avoid_: install script (`install.sh` is distribution; Reset State is convergence)

**State Sync**:
A full-machine ordered reset-all in dependency order (code: `performSync`, which persists per-key receipts; each key's `reset` checks internally — there is no separate check-all phase).
_Avoid_: full reset (server `reset-config{keys:"*"}` maps to the same path plus ws `reset-ack*`/`sync-ack`)

**Drift**:
A per-key `actual vs desired` mismatch reported by Check State.
_Avoid_: diff, error

**Convergence Receipt**:
A per-key `ok / error` row produced by Reset State or State Sync for one `jobId` (stored in `config_receipts`; sent as `reset-ack`/`sync-ack` frames on the daemon path).
_Avoid_: using ack or log for the stored row (ack = wire frame, receipt = stored row)

**Quota**:
A cap on how many sandboxes a machine may hold or run (code/config name is `Limits {maxRunning, maxTotal}` — Quota is the domain term for the same values).
_Avoid_: limit (verb), throttle

### Known code gaps

- Strict binding: `SandboxInfoSchema` (`../orpc-contract/src/schemas/primitives.ts`) allows `taskId: string | null` and `projectId: string | null`, and the `sandbox list` command prints `global` for null. Per grill 2026-09-10 the domain invariant is strict (exactly one Task, exactly one Scope; `null` projectId is the wire encoding of global Scope, not an unbound sandbox). `taskId: null` only occurs for foreign/unlabeled sandboxes seen via list. Idle `stopped` sandboxes awaiting TTL reap remain bound to their last Task. Do not create unbound sandboxes.
- Pressure attribution: `sandboxMetricsForPressure` joins `task.id`/`project.id` labels, but the SDK is the only driver exposing metrics — CLI/mock report `[]`, so scoped hints degrade to host-global there.
- Unsent contract frames: `check-ack` is defined but never sent (contract-only). `validateMachineFrame` is now enforced on every outbound `send` via `assertMachineFrame`. Buffered logs replay via `resendBufferedLogs` (peek → send → delete-through, at-least-once).
- Quota refusal shape: the quota-path `claim-ack` carries a generated placeholder `sandboxId` (no sandbox is created), satisfying `ClaimAckFrameSchema(min(1))`.
- Planned-not-implemented policy (historical remote-machine plan §11, file no longer in tree): per-Task `--net/--no-net`, refusing `reset` while a sandbox is `running`, and Ubuntu pre-pull inside `enroll` (pre-pull lives in `install.sh` today; `programs.reset` only probes).
