# AGENTS.md — apps/orpc-contract

Frozen `v1` machine↔server wire contract. Consumed as `@uma/orpc-contract` (workspace dep) by `apps/machine` and `apps/web`. This package never imports from either app. Policy in `docs/` (`FRAMES.md` frame catalog, `VERSIONING.md` freeze/upgrade runbook).

## Commands (run in `apps/orpc-contract`)

- No build/test/lint scripts of its own. Typecheck: `bunx tsc --noEmit` (in this dir; covered by root project references). Lint/format from root: `bun run check:lint` / `bun run format`.
- After any contract change: `bun run docs:wire` in `apps/machine` (regenerates `apps/machine/docs/wire-schema.json`), then update `apps/machine/docs/ARCHITECTURE.md` (Contract section) + server docs.

## Conventions

- Layout: `src/index.ts` barrel, `src/constants.ts` (`PROTOCOL_VERSION`, `UBUNTU_IMAGE`, task sizing, heartbeat cadence/retention, log cap, pressure policy, ws path, reserved names), `src/ids.ts` (wire-visible ID shapes), `src/schemas/` (machine-frames, server-frames, primitives), `src/contracts/`, `src/utils.ts` (`needsUpgrade`/`compareVersions`, `branchForTask`, `effectiveLimits`, `quotaDefaultsFromRam`). Keep this layout; both consumers import the barrel, not deep paths.
- Frozen means frozen: frame names (`t`), required fields, validation semantics, constants (incl. `UBUNTU_IMAGE`, `PROTOCOL_VERSION`), `protocol: "v1"`, `projectId: null` = global scope, log-cap semantics, branch/quota defaults, ID prefixes/lengths.
- Safe without a major (minor): new optional field, new `t` old peers ignore (unknown inbound `t` is already ignored), loosening validation without changing meaning.
- Breaking = major + `UPGRADE_REQUIRED{minVersion, reason?}` handling on both sides: renames/removals, optional→required, tighter validation, changing `protocol`, redefining `null` `projectId` or log-cap semantics. Agent exits `3` so the operator reinstalls.
- Machine side must keep ignoring unknown inbound `t` and must never send unvalidated frames (contract `validateMachineFrame` in `src/schemas/machine-frames.ts:129`, enforced via machine-side `assertMachineFrame` in `apps/machine/src/execution/protocol.ts:15`). Use `semver` with the naive numeric fallback in `utils.ts` — don't introduce a second version-compare.
- Deps stay tiny (`@orpc/contract`, `@orpc/openapi`, `nanoid`, `semver`, `zod` via catalog). No runtime deps on machine/web code, ever.
