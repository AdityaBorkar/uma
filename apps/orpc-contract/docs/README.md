# orpc-contract — frozen v1 wire contract

Single source of truth for machine↔server wire shapes. Imported by `apps/machine` via relative path (`../orpc-contract/src/index.ts`). This package never imports from `apps/machine/src`.

## Layout

- `src/constants.ts` — frozen `v1` values: `PROTOCOL_VERSION`, `UBUNTU_IMAGE`, task CPU/RAM sizes, heartbeat cadence/retention, `LOG_FRAME_CAP_BYTES` (256KB UTF-8), pressure thresholds/windows, `MACHINES_WS_PATH`, `RESERVED_MACHINE_NAMES`.
- `src/schemas/primitives.ts` — shared primitives: `Limits`, `QuotaUsage`, `HostMetrics`, `SandboxInfo`, `MachineName`, `ConnectionStatus`.
- `src/schemas/machine-frames.ts` — machine→server frames (all carry `machineId` + `protocol: "v1"`). See `FRAMES.md`.
- `src/schemas/server-frames.ts` — server→machine frames. See `FRAMES.md`.
- `src/schemas/device.ts` — HTTPS/oRPC shapes: device-code flow (`DeviceCode*`, `DeviceToken*`, `DeviceTokenError`) and `TaskClaimRequest`, `DriftEntry`, `Receipt`.
- `src/schemas/` — API I/O schemas for the contract routers: web-domain inputs (mirroring `apps/web/src/schemas/schema.ts`), loose row/page/stats outputs, machine HTTPS responses (`TaskClaimResponse`, `LatestVersionResponse`, …), WS channel I/O (`WsSendAck`, `WsSubscribeInput`), shared primitives (`primitives.ts`), and WS frames (`machine-frames.ts`, `server-frames.ts`). Split per domain: `common.ts` (DbRecord/page/stats/id/remove envelopes), `projects.ts`, `connections.ts`, `signals.ts`, `tasks.ts`, `documents.ts` (incl. comments), `machines.ts`, `ws.ts`; re-exported via `schemas/index.ts`.
- `src/contracts/api.ts` — `apiContract`: `oc` router (from `@orpc/contract`) over the schemas above. Namespaces `tasks/signals/projects/documents/connections` mirror `apps/web/src/rpc/router.ts`; `device`/`machines` cover machine enrollment + claim/version/history. Implement with `implement(apiContract)` from `@orpc/server`. Every procedure carries `openapi({ method, path, ... })` metadata (from `@orpc/openapi`) so the same contract serves RPC **and** REST: `RPCHandler` at `/api/rpc` (unchanged) plus `OpenAPIHandler` and OpenAPI-spec generation. See "REST endpoints" below.
- `src/contracts/ws.ts` — WS messages contract (frozen v1): `wsMessagesContract` is the raw-frame registry (`path`, `protocol`, per-`t` schemas for both directions); `wsContract` models the same channel as `oc` procedures (`machines.send` for machine→server frames, `machines.stream` as an `asyncIteratorObject(ServerFrameSchema)` for server→machine). Transport stays raw JSON frames, not an oRPC envelope.
- `src/contracts/index.ts` + `src/index.ts` — barrel re-exports: schemas and contracts are both exported from the package root.
- `src/utils.ts` — pure helpers: `branchForTask`, `effectiveLimits`, `quotaDefaultsFromRam`, `compareVersions` / `needsUpgrade`.
- `src/index.ts` — barrel re-export only.

## REST endpoints

Each `apiContract` procedure maps to one REST endpoint (method + path in
`src/contracts/api.ts`). CRUD resources use nouns + standard verbs; machine /
device operations are actions whose paths mirror the procedure name.

| Procedure | Method | Path |
|---|---|---|
| `connections.list` | `GET` | `/connections` |
| `connections.providers` | `GET` | `/connections/providers` |
| `connections.get` | `GET` | `/connections/{provider}` |
| `connections.getAuthUrl` | `GET` | `/connections/{provider}/auth-url` |
| `connections.disconnect` | `DELETE` | `/connections/{provider}` |
| `device.code` | `POST` | `/device/code` |
| `device.token` | `POST` | `/device/token` |
| `documents.list` | `GET` | `/documents` |
| `documents.create` | `POST` | `/documents` (201) |
| `documents.get` | `GET` | `/documents/{number}` |
| `documents.update` | `PATCH` | `/documents/{number}` |
| `documents.remove` | `DELETE` | `/documents/{number}` |
| `documents.close` | `POST` | `/documents/{number}/close` |
| `documents.reopen` | `POST` | `/documents/{number}/reopen` |
| `documents.comments.create` | `POST` | `/documents/{documentNumber}/comments` (201) |
| `machines.checkState` | `GET` | `/machines/check-state` |
| `machines.claim` | `POST` | `/machines/claim` |
| `machines.heartbeatHistory` | `GET` | `/machines/heartbeats` |
| `machines.latestVersion` | `GET` | `/machines/versions/latest` |
| `machines.resetState` | `POST` | `/machines/reset-state` (202, async — receipts arrive over WS) |
| `machines.sandboxList` | `GET` | `/machines/sandboxes` |
| `projects.list` | `GET` | `/projects` |
| `projects.create` | `POST` | `/projects` (201) |
| `projects.get` | `GET` | `/projects/{id}` |
| `projects.getBySlug` | `GET` | `/projects/by-slug/{slug}` |
| `projects.update` | `PATCH` | `/projects/{id}` |
| `signals.list` | `GET` | `/signals` |
| `signals.create` | `POST` | `/signals` (201) |
| `signals.get` | `GET` | `/signals/{id}` |
| `signals.update` | `PATCH` | `/signals/{id}` |
| `signals.stats` | `GET` | `/signals/stats` |
| `tasks.list` | `GET` | `/tasks` |
| `tasks.create` | `POST` | `/tasks` (201) |
| `tasks.get` | `GET` | `/tasks/{id}` |
| `tasks.stats` | `GET` | `/tasks/stats` |
| `tasks.updateStatus` | `PATCH` | `/tasks/{id}/status` |

Notes for implementers:

- Path-param names match input-schema keys (`{id}`, `{provider}`, `{slug}`,
  `{number}`, `{documentNumber}`); oRPC compact mapping merges path params
  with the query (GET/DELETE) or body (POST/PATCH).
- Numeric params (`{number}`, `?limit=`) arrive as strings over HTTP. Serve
  the REST transport with `SmartCoercionHandlerPlugin` (plus
  `ZodToJsonSchemaConverter` from `@orpc/zod`) so they coerce to numbers.
- Static routes (`/tasks/stats`, `/connections/providers`,
  `/projects/by-slug/{slug}`) coexist with dynamic siblings (`/tasks/{id}`,
  …); values never collide in practice (UUIDs vs literals, `github|google`
  vs `providers`).
- Generate the spec with `OpenAPIGenerator` from `@orpc/openapi` (converters:
  `[new ZodToJsonSchemaConverter()]`) directly from `apiContract`.

## Freeze policy

- `protocol: "v1"` is required on every ws frame. Unknown inbound `t` is logged and ignored (`parseServerFrame` returns `null`, never throws); unknown outbound is never sent (`validateMachineFrame` / `assertMachineFrame` on send).
- `null` `projectId` is the wire encoding of global Scope, not an unbound sandbox.
- Log chunks are capped at 256KB UTF-8 bytes measured with `TextEncoder` (byte length, not UTF-16 length), so multibyte text is capped exactly.
- Any wire-frame change requires a major version bump and `UPGRADE_REQUIRED` handling. See `VERSIONING.md`.
- Machine snapshot: `apps/machine/docs/wire-schema.json` is generated from these schemas via `bun run docs:wire` in `apps/machine` (script `scripts/generate-wire-schema.ts`). Do not edit by hand.
