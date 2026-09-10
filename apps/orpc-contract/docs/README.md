# orpc-contract — frozen v1 wire contract

Single source of truth for machine↔server wire shapes. Imported by `apps/machine` via relative path (`../orpc-contract/src/index.ts`). This package never imports from `apps/machine/src`.

## Layout

- `src/constants.ts` — frozen `v1` values: `PROTOCOL_VERSION`, `UBUNTU_IMAGE`, task CPU/RAM sizes, heartbeat cadence/retention, `LOG_FRAME_CAP_BYTES` (256KB UTF-8), pressure thresholds/windows, `MACHINES_WS_PATH`, `RESERVED_MACHINE_NAMES`.
- `src/primitives.ts` — shared primitives: `Limits`, `QuotaUsage`, `HostMetrics`, `SandboxInfo`, `MachineName`, `ConnectionStatus`.
- `src/machine-frames.ts` — machine→server frames (all carry `machineId` + `protocol: "v1"`). See `FRAMES.md`.
- `src/server-frames.ts` — server→machine frames. See `FRAMES.md`.
- `src/orpc.ts` — HTTPS/oRPC shapes: device-code flow (`DeviceCode*`, `DeviceToken*`, `DeviceTokenError`) and `TaskClaimRequest`, `DriftEntry`, `Receipt`.
- `src/utils.ts` — pure helpers: `branchForTask`, `effectiveLimits`, `quotaDefaultsFromRam`, `compareVersions` / `needsUpgrade`.
- `src/index.ts` — barrel re-export only.

## Freeze policy

- `protocol: "v1"` is required on every ws frame. Unknown inbound `t` is logged and ignored (`parseServerFrame` returns `null`, never throws); unknown outbound is never sent (`validateMachineFrame` / `assertMachineFrame` on send).
- `null` `projectId` is the wire encoding of global Scope, not an unbound sandbox.
- Log chunks are capped at 256KB UTF-8 bytes measured with `TextEncoder` (byte length, not UTF-16 length), so multibyte text is capped exactly.
- Any wire-frame change requires a major version bump and `UPGRADE_REQUIRED` handling. See `VERSIONING.md`.
- Machine snapshot: `apps/machine/docs/wire-schema.json` is generated from these schemas via `bun run docs:wire` in `apps/machine` (script `scripts/generate-wire-schema.ts`). Do not edit by hand.
