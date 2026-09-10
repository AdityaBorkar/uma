# ADR 003 — Global (Per-User) Weekly Cycles

**Date:** 2026-08-22
**Status:** Superseded by [ADR 005](005-remove-weekly-cycles.md) — weekly cycles removed entirely
**Supersedes:** ADR 002 D2 ("Cycles stay per-project in v1")

> **Historical record.** This ADR made cycles global, per-user domains. The
> cycles concept (schema, lifecycle, scheduler, UI) has since been removed —
> see [ADR 005](005-remove-weekly-cycles.md).

## Context

ADR 002 established weekly cycles — fixed Monday → Sunday planning periods
(`src/db/schema/cycles.ts`, `src/lib/week.ts`). Its decision **D2** kept cycles
**per-project** in v1: `weekly_cycles.projectId NOT NULL` with
`UNIQUE (projectId, startDate)` — one cycle per project per week.

Product direction has since changed: a week's planning is a single, coherent
period across the whole of a user's work, not one split per project. Per-project
cycles fragmented the weekly rhythm (each project drifted onto its own cycle)
and made "what did this week deliver?" impossible to answer in one view.

## Decision

Make weekly cycles **global domains**: a cycle is not owned by any project.

- A cycle is owned by the **user** (`weekly_cycles.createdBy NOT NULL`) and is
  unique per **user per ISO week**: `UNIQUE (createdBy, startDate)`.
- `weekly_cycles.projectId` is **removed**. Projects relate to cycles only
  **loosely by week** — a project's work that falls in a given week is
  implicitly part of that user's cycle for the week. There is no
  project↔cycle join table and no `projects.cycleId`.
- Tasks already bridge the two domains: a task independently carries
  `projectId` and `cycleId`, so a task can be scoped to a project *and* to the
  global weekly cycle.
- Top-level `/cycles` becomes the canonical cycles surface (list + detail),
  replacing the per-project `/projects/$projectId/cycles` routes.
- Ownership checks in `cycles.*` procedures verify `createdBy` equals the
  caller, replacing the former `verifyProjectOwnership` gate.

### Consequences

- One global cycle per user per week; the weekly rhythm answers "what did my
  week across every project deliver?" in a single view.
- Cycle activation/lifecycle (`src/lib/cycle-lifecycle.ts`) needs no project
  scoping; the read-time fallback is scoped by `userId`, and the scheduler
  runs across all users.
- `cycle_contributors` (one row per human per cycle) still works as-is, now
  representing participants in the global weekly cycle rather than one
  project's cycle.

## Alternatives Considered

- **Keep per-project cycles (ADR 002 D2).** Rejected: fragmented the weekly
  rhythm and split planning across projects.
- **Join table `project_cycles`.** Rejected for v1 as YAGNI — nothing reads a
  project→cycle binding today; tasks/signals already bridge by `cycleId` /
  `projectId` independently. Can be added later without undoing this model.
- **`projects.cycleId` FK.** Rejected: a cycle spans many projects, so a
  single nullable FK on the project would mis-model the relationship.

## Traceability

- Reverses ADR 002 §14 **D2** and the corresponding implementation (schema
  `UNIQUE (projectId, startDate)`, the `weekly_cycles.projectId` FK, the
  per-project cycles routes).
- Implemented per user's explicit direction; see `src/db/schema/cycles.ts` and
  `src/db/schema/tasks.ts` for the current global-cycle model.