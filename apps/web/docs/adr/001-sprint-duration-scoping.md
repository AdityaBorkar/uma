# ADR 001 — Sprint Duration Scoping

**Date:** 2026-08-20
**Status:** Superseded by ADR 002, which is in turn superseded by [ADR 005](005-remove-weekly-cycles.md)
**Context:** Prior to weekly cycles, sprint duration needed a source of truth (per-project column vs global `workspace_settings`). This ADR recorded the hybrid decision; it is **superseded by ADR 002**, and the sprint *and* weekly-cycles concepts are both now removed (ADR 005). History only.

## Decision

Implement **hybrid A+B** for v1:

- `projects.sprintDurationDays` — `integer NOT NULL DEFAULT 14` — per-project override, snapshot source for future sprints in that project. Editing a project’s duration only affects sprints created afterwards in that project.
- `workspace_settings.defaultSprintDurationDays` — `integer NOT NULL DEFAULT 14` — global workspace default, one row per `userId` (`UNIQUE`). Used when:
  - a new project is created without an explicit duration (fallback copy), and
  - a project’s `getSprintDuration` is requested without a `projectId` (Settings global card).
- `sprints.durationDays` — denormalized snapshot at creation, invariant `durationDays = endDate - startDate + 1`. Changing either global or per-project setting **does not** rewrite existing sprints’ dates.

Effective resolution order for creating a sprint in `project X`:

1. If `sprints.create` input provides `durationDays`, use it (validated against dates).
2. Else if `projects.sprintDurationDays` is set, use it.
3. Else fall back to `workspace_settings.defaultSprintDurationDays` for the current user, else `14`.

For the Settings page:

- Global card edits `workspace_settings` via `settings.updateSprintDuration({ durationDays })`.
- Per-project table edits `projects.sprintDurationDays` via `settings.updateSprintDuration({ projectId, durationDays })` (or `projects.update` equivalently). “Use default” copies the current global value into the project, making the override explicit rather than `NULL` — keeps `NOT NULL` invariant and simplifies Drizzle queries while still satisfying AC-D3 via manual override propagation in the future if needed.

## Alternatives Considered

- **Pure Option A:** simpler migration, but global change would not affect “any project” new sprints (AC-D3 ambiguous). Would require a later migration to add workspace_settings, risking a second DDL.
- **Pure Option B with nullable `projects.sprintDurationDays`:** cleaner inheritance (`NULL = use default`) but introduces nullable semantics and complicates `check 1..90` handling; also requires `COALESCE` in every sprint-creation query.

## Consequences

- Two tables, but no `NULL` sprint duration path — application code decides fallback, not SQL `COALESCE`.
- `sprints.durationDays` snapshot guarantees history is immutable; duration changes are write-through with toast and `posthog.capture("sprint_duration_changed", { oldDuration, newDuration, scope })`.
- Future multi-workspace phase can replace `userId` scoping with `workspaceId` without changing the per-sprint snapshot model.
- Migration is `drizzle/0000_silly_sunfire.sql` (single file) — reproducible on fresh `docker-compose down -v && docker-compose up -d && bun run db:migrate`.

## Traceability

- Implements `docs/notes/PRINCIPLES.md:5` #2 (Reduce WIP) and #4 (Shorten Feedback Loops) — cadence is a deliberate constraint, not an afterthought.
- Primes domains **A.Project** and calendar primitive for downstream WBS/CPM/Flow/TOC/Estimation.
