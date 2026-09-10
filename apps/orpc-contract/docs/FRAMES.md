# FRAMES — v1 catalog

All ws frames are JSON with `protocol: "v1"`. Machine→server frames also carry `machineId`.

## Machine → server (`src/schemas/machine-frames.ts`)

| `t` | Purpose | Key fields |
|---|---|---|
| `heartbeat` | Periodic health + pressure signal (default every 30s) | `cliVersion`, `configVersion`, `metrics` (`cpu/ram/disk/pids`), `quotaUsage` (`running/total`), `sandboxes[]` (`SandboxInfo`), `scopeHint` (`string \| null`) |
| `log` | Streaming exec output | `taskId`, `chunk` (≤256KB UTF-8 bytes, byte-length refine), `stream` (`stdout \| stderr \| system`, optional) |
| `task-done` | Terminal outcome for one Task | `taskId`, `status` (`completed \| failed`), `projectId` (`string \| null`), `result` (optional, ≤64k chars) |
| `check-ack` | Drift report for one `jobId` (contract-only: defined but never sent by the agent today) | `jobId`, `drift[]` (`DriftEntry`: `key/drifted/detail?`) |
| `reset-ack` | Per-key convergence receipt | `jobId`, `key`, `ok`, `error?` |
| `sync-ack` | Full-machine ordered reset-all receipts | `jobId`, `receipts[]` (`Receipt`: `key/ok/error?`) |
| `claim-ack` | Result of the atomic `tasks.claim` step | `taskId`, `sandboxId` (min 1; quota-refusal path carries a generated placeholder id since no sandbox is created), `ok`, `error?` (`QUOTA_EXCEEDED` or free string) |
| `quota-exceeded` | Local quota refusal, no exec | `taskId`, `limits`, `usage` |

Validation: `MachineFrameSchema` (discriminated union on `t`); outbound enforced via `validateMachineFrame` / `assertMachineFrame` on every send.

## Server → machine (`src/schemas/server-frames.ts`)

| `t` | Purpose | Key fields |
|---|---|---|
| `assign` | Run one Task in one sandbox | `taskId`, `projectId` (`string \| null`), `prompt`, `repoUrl`, `branch?`, `commit?`, `freshStart?`, `limits?` (partial `Limits` override) |
| `cancel` | Stop the in-flight run for a Task | `taskId` |
| `reset-config` | Converge config keys toward desired state | `jobId`, `keys` (`string[] \| "*"`, where `"*"` maps to the ordered sync path plus `sync-ack`), `version`, `payload?` (`limits?`, `templates?`, provider `keys?`) |
| `UPGRADE_REQUIRED` | Major-version gate | `minVersion`, `reason?` → agent exits `3` |

Parsing: `parseServerFrame` returns `ServerFrame | null`; unknown `t` maps to `null` (logged + ignored).

## Primitives (`src/schemas/primitives.ts`)

- `Limits` (`maxRunning/maxTotal` required, `cpu/ram` optional), `QuotaUsage` (`running/total`), `HostMetrics` (`cpu/ram/disk` 0–100, `pids`).
- `SandboxInfo` (`id`, `status: created | running | stopped | destroyed`, `taskId: string | null`, `projectId: string | null`). `taskId: null` only occurs for foreign/unlabeled sandboxes seen via list; the agent never creates unbound sandboxes.
- `MachineName` (slug-like lowercase 1–64, not in `RESERVED_MACHINE_NAMES`), `ConnectionStatus` (`enrolled | connected | disconnected | revoked`).

## HTTPS/oRPC (`src/orpc.ts`)

Device-code enrollment (`DeviceCodeRequest/Response`, `DeviceTokenRequest/Response`, `DeviceTokenError`: `authorization_pending | slow_down | expired_token | access_denied`), atomic claim (`TaskClaimRequest`: `machineId/sandboxId/taskId`), and shared `DriftEntry` / `Receipt` shapes reused by `check-ack` / `reset-ack` / `sync-ack`.
