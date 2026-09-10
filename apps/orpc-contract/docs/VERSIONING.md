# VERSIONING — v1 freeze and upgrade runbook

## Rule

Wire-frame changes require a major version. `PROTOCOL_VERSION` lives in `src/constants.ts`. The server sends `UPGRADE_REQUIRED{minVersion, reason?}`; the agent compares with `needsUpgrade` / `compareVersions` in `src/utils.ts` (semver with naive numeric fallback) and exits `3` so the operator reinstalls (systemd backs off; user re-runs `install.sh`).

## What is frozen

- Frame names (`t`), required fields, and validation semantics in `src/schemas/machine-frames.ts` / `src/schemas/server-frames.ts`.
- Constants in `src/constants.ts`: task sizing (`TASK_CPUS`, `TASK_MEMORY_MB`, `TASK_MAX_CPUS`, `TASK_MAX_MEMORY_MB`), heartbeat cadence/retention (`HEARTBEAT_INTERVAL_S`, `HEARTBEAT_RETENTION_DAYS`), log cap (`LOG_FRAME_CAP_BYTES`), pressure policy (`PRESSURE_THRESHOLD_PCT`, `PRESSURE_SUSTAINED_S`, `PRESSURE_ATTRIBUTION_PCT`, `PRESSURE_COOLDOWN_S`), ws path (`MACHINES_WS_PATH`), reserved names (`RESERVED_MACHINE_NAMES`).
- Branch default (`branchForTask`: `task/<short>` unless explicit) and quota defaults (`quotaDefaultsFromRam`: `2×/5×` per GB RAM, floor 1) in `src/utils.ts`.

## Safe vs breaking

- Safe (minor): adding an optional field, adding a new `t` that old peers ignore (unknown inbound `t` is already ignored), loosening validation without changing meaning.
- Breaking (major): renaming/removing a frame or field, making an optional field required, tightening validation, changing `protocol` value, changing the meaning of `null` `projectId` or log-cap semantics. All of these need a major + `UPGRADE_REQUIRED` handling on both sides.

## How to change

1. Bump the major, keep `protocol: "v1"` handling for old peers until the server forces upgrade.
2. Update schemas + `FRAMES.md`, regenerate the machine snapshot (`bun run docs:wire` in `apps/machine` → `apps/machine/docs/wire-schema.json`), and update both `apps/machine/docs/ARCHITECTURE.md` (Contract section) and server docs.
3. The agent must keep ignoring unknown inbound `t` and must never send unknown frames (`validateMachineFrame` on send).
