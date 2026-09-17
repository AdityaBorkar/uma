# Machine server (control-plane owned)

The `server-central` test harness is gone. The production machine server lives
in the control plane (`apps/server`, `Bun.serve`):

- `src/machines/service.ts` — device flow, machine sessions, heartbeats,
  atomic claim, task logs/finish, reset fan-out.
- `src/machines/frames.ts` — inbound WS frame dispatch (v1 validation,
  unknown `t` ignored).
- `src/machines/sockets.ts` — in-process `machineId → peers` registry
  (single instance; Redis pub/sub if ever multi-replica).
- `src/machines/config.ts` — `MIN_CLI_VERSION`, allowlist, TTLs.
- `src/rpc/procedures/device.ts`, `src/rpc/procedures/machines.ts` — canonical
  typed surface (`device.code/token/approve`, `machines.claim/latestVersion/...`).
- HTTP handlers (`src/http/machines.ts`, `src/ws.ts`): `POST /api/machines/device/code`, `POST /api/machines/device/token` (raw OAuth shapes
  for the binary), `POST /api/machines/claim` (raw claim for the binary),
  `GET /api/machines/version`, `GET /api/machines/health`, plus `/device` (browser approval, web UI)
  and `/settings/machines` (registry, web UI).
- `src/ws.ts` — raw v1 frames at `/api/machines/ws` (`Bun.serve` websocket
  handlers; machine Bearer auth before upgrade).

## Wire compatibility

`uma-machine` uses plain `fetch` + `WebSocket` (no oRPC client in the binary).
The oRPC procedures at `/api/rpc/*` use the `{json, meta}` envelope, so the
binary talks to the raw shims above instead — same service functions, same
contract schemas from `@uma/orpc-contract`.

## Env

- `MACHINE_CLIENT_ALLOWLIST` (optional, default `uma-machine,roundtrip`).
- `E2E_SEED` (optional bool, default false) — enables `/api/debug/*` seed
  helpers for `bun run roundtrip` in `apps/machine`. Never enable in
  production (dev stack only).
- `CORS_EXTRA_ORIGINS` (optional) — extra browser origins allowed with
  credentials (the web origin is always allowed).

## Local roundtrip

1. `bun run db:push` in `apps/server` against the dev DB (tables: `machines`,
   `device_codes`, `machine_sessions`, `machine_heartbeats`,
   `machine_sandboxes`, `task_runs`, `task_logs`).
2. Run the server with `E2E_SEED=1` (`bun run dev` in `apps/server`) and the
   web UI (`bun run dev` in `apps/web`, proxies `/api/*` to the server).
3. `cd apps/machine && bun run roundtrip --server http://127.0.0.1:3000`
   (or `--server http://127.0.0.1:4000` to hit the control plane directly).

## Schema notes

- `UNIQUE(userId, name)` on machines; duplicate approval denies the grant so
  the poller sees `access_denied`.
- Claim is `UPDATE tasks … WHERE status='queued'` (409 on conflict) plus a
  `machine_sandboxes` upsert — no columns added to `tasks`.
