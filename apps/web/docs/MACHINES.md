# Machine server (web-owned)

The `server-central` test harness is gone. The production machine server lives
in this app:

- `src/lib/machines/service.ts` — device flow, machine sessions, heartbeats +
  pressure→Signal, atomic claim, task logs/finish, reset fan-out.
- `src/lib/machines/frames.ts` — inbound WS frame dispatch (v1 validation,
  unknown `t` ignored).
- `src/lib/machines/sockets.ts` — in-process `machineId → peers` registry
  (single instance; Redis pub/sub if ever multi-replica).
- `src/lib/machines/config.ts` — `MIN_CLI_VERSION`, allowlist, TTLs.
- `src/rpc/procedures/device.ts`, `src/rpc/procedures/machines.ts` — canonical
  typed surface (`device.code/token`, `machines.claim/latestVersion/...`).
- TanStack routes: `POST /device/code`, `POST /device/token` (raw OAuth shapes
  for the binary), `POST /api/machines/claim` (raw claim for the binary),
  `GET /api/version`, `GET /health`, `/device` (browser approval),
  `/settings/machines` (registry).
- `server/machines-ws.ts` — raw v1 frames at `/api/machines/ws` (Nitro
  `defineWebSocketHandler`, registered in `vite.config.ts` with
  `features.websocket`). TanStack file routes are HTTP-only, so WS lives here.

## Wire compatibility

`uma-machine` uses plain `fetch` + `WebSocket` (no oRPC client in the binary).
The oRPC procedures at `/api/rpc/*` use the `{json, meta}` envelope, so the
binary talks to the raw shims above instead — same service functions, same
contract schemas from `@uma/orpc-contract`.

## Env

- `MACHINE_CLIENT_ALLOWLIST` (optional, default `uma-machine,roundtrip`).
- `E2E_SEED` (optional bool, default false) — enables `/api/test/*` seed
  helpers for `bun run roundtrip` in `apps/machine`. Never enable in
  production (dev stack only).
- `NITRO_PRESET=bun` at build time (set in the Dockerfile) — the default node
  preset's websocket adapter refuses to start under the Bun runtime.

## Local roundtrip

1. `drizzle-kit push` against the dev DB (tables: `machines`,
   `device_codes`, `machine_sessions`, `machine_heartbeats`,
   `machine_sandboxes`, `task_logs`, `machine_pressure_state`).
2. Run web with `E2E_SEED=1`.
3. `cd apps/machine && bun run roundtrip --server http://127.0.0.1:3000`.

## Schema notes

- `UNIQUE(userId, name)` on machines; duplicate approval denies the grant so
  the poller sees `access_denied`.
- Claim is `UPDATE tasks … WHERE status='queued'` (409 on conflict) plus a
  `machine_sandboxes` upsert — no columns added to `tasks`.
- Pressure samples live in `machine_pressure_state`; sustained over-threshold
  windows insert `source='alert'` rows into `signals` (10min sustain/cooldown,
  contract constants).
