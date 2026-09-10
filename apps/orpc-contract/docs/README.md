# orpc-contract — frozen v1 wire contract

Single source of truth for machine↔server wire shapes. Imported by `apps/machine` via relative path (`../orpc-contract/src/index.ts`). This package never imports from `apps/machine/src`.

## Layout

- `src/constants.ts` — frozen `v1` values: `PROTOCOL_VERSION`, `UBUNTU_IMAGE`, task CPU/RAM sizes, heartbeat cadence/retention, `LOG_FRAME_CAP_BYTES` (256KB UTF-8), pressure thresholds/windows, `MACHINES_WS_PATH`, `RESERVED_MACHINE_NAMES`.
- `src/primitives.ts` — shared primitives: `Limits`, `QuotaUsage`, `HostMetrics`, `SandboxInfo`, `MachineName`, `ConnectionStatus`.
- `src/machine-frames.ts` — machine→server frames (all carry `machineId` + `protocol: "v1"`). See `FRAMES.md`.
- `src/server-frames.ts` — server→machine frames. See `FRAMES.md`.
- `src/orpc.ts` — HTTPS/oRPC shapes: device-code flow (`DeviceCode*`, `DeviceToken*`, `DeviceTokenError`) and `TaskClaimRequest`, `DriftEntry`, `Receipt`.
- `src/api-schemas.ts` — API I/O schemas for the contract routers: web-domain inputs (mirroring `apps/web/src/schemas/schema.ts`), loose row/page/stats outputs, machine HTTPS responses (`TaskClaimResponse`, `LatestVersionResponse`, …), and WS channel I/O (`WsSendAck`, `WsSubscribeInput`).
- `src/contracts/api.ts` — `apiContract`: `oc` router (from `@orpc/contract`) over the schemas above. Namespaces `tasks/signals/projects/documents/connections` mirror `apps/web/src/rpc/router.ts`; `device`/`machines` cover machine enrollment + claim/version/history. Implement with `implement(apiContract)` from `@orpc/server`.
- `src/contracts/ws.ts` — WS messages contract (frozen v1): `wsMessagesContract` is the raw-frame registry (`path`, `protocol`, per-`t` schemas for both directions); `wsContract` models the same channel as `oc` procedures (`machines.send` for machine→server frames, `machines.stream` as an `eventIterator(ServerFrameSchema)` for server→machine). Transport stays raw JSON frames, not an oRPC envelope.
- `src/contracts/index.ts` + `src/index.ts` — barrel re-exports: schemas and contracts are both exported from the package root.
- `src/utils.ts` — pure helpers: `branchForTask`, `effectiveLimits`, `quotaDefaultsFromRam`, `compareVersions` / `needsUpgrade`.
- `src/index.ts` — barrel re-export only.

## Freeze policy

- `protocol: "v1"` is required on every ws frame. Unknown inbound `t` is logged and ignored (`parseServerFrame` returns `null`, never throws); unknown outbound is never sent (`validateMachineFrame` / `assertMachineFrame` on send).
- `null` `projectId` is the wire encoding of global Scope, not an unbound sandbox.
- Log chunks are capped at 256KB UTF-8 bytes measured with `TextEncoder` (byte length, not UTF-16 length), so multibyte text is capped exactly.
- Any wire-frame change requires a major version bump and `UPGRADE_REQUIRED` handling. See `VERSIONING.md`.
- Machine snapshot: `apps/machine/docs/wire-schema.json` is generated from these schemas via `bun run docs:wire` in `apps/machine` (script `scripts/generate-wire-schema.ts`). Do not edit by hand.
