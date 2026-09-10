# ADR 002 — Weekly Cycles (Replace Sprints)

**Date:** 2026-08-21
**Status:** Superseded by [ADR 005](005-remove-weekly-cycles.md) — weekly cycles removed entirely
**Supersedes:** [ADR 001 — Sprint Duration Scoping](001-sprint-duration-scoping.md)

> **Historical record.** This ADR recorded the adoption of weekly cycles. The
> cycles concept (schema, lifecycle, scheduler, UI) has since been removed —
> see [ADR 005](005-remove-weekly-cycles.md). The code paths referenced below
> no longer exist.

## Context

Arbitrary-length sprints (default 14 days, free-choice start dates) are
replaced with **weekly cycles** — fixed planning periods that always start on
Monday 00:00 UTC and end Sunday 23:59. Cadence becomes a property of the
calendar, not a setting: no configurable durations, no gaps, no mid-week
starts. This supersedes the duration-scoping decisions in ADR 001 (SOW §14, D1).
Implemented in `src/db/schema/cycles.ts`, `src/lib/week.ts`, and
`src/lib/cycle-lifecycle.ts`.

The product's mental model (`docs/notes/PRINCIPLES.md:5`) is
`Outcome → Scope → Sequence → Constraints → Feedback → Decisions → Completion`.
Each cycle carries an explicit **outcome** (what result the week produces),
strengthening the `Outcome → Feedback` link, and records **per-human
metrics** (commitment + committed/completed/carried counts) so individual
throughput is visible at the week level.

Repo maturity (3 commits, seed-only data, no production users) permits a
clean, destructive migration.

## Decision

Replace sprints with weekly cycles and human-specific metrics:

- **`weekly_cycles`** (replaces `sprints`): one row per user per ISO week,
  `startDate` always a Monday and `endDate = startDate + 6`, both enforced by
  DB `CHECK` constraints; `UNIQUE (createdBy, startDate)` (global, per-user —
  per ADR 003); denormalized
  `isoYear`/`isoWeek` for sorting; auto-named from the ISO week key
  (`2026-W34`) with an overridable display name; `outcome` replaces `goal`
  (≤500 chars, empty allowed but flagged in UI).
- **`cycle_contributors`** (new): one row per participating human per cycle,
  `UNIQUE (cycleId, userId)`, with `commitment` plus
  `committedCount`/`completedCount`/`carriedOverCount` (all ≥ 0 via `CHECK`).
  Commitments set at planning; completed/carried set at review.
- **`projects.deadlineDate`** — optional project-level target constrained to
  fall on a Sunday (`CHECK EXTRACT(ISODOW) = 7`); expressed in the UI as
  weeks remaining. Advisory/soft, never blocking.
- **Status lifecycle (FR-5):** `planned → active` transitions automatically
  when the week starts, driven by a scheduled **pg-boss** cron and mirrored by
  an idempotent read-time fallback so the UI stays correct even if the
  scheduler is down. `active → completed` stays a manual action at weekly
  review. Ended-but-uncompleted cycles are derived as "review pending"
  (`status='active' AND endDate < today`) — never silently active.
- **Removed:** `projects.sprintDurationDays`,
  `workspace_settings.defaultSprintDurationDays`, the `sprints.*` procedure
  namespace, the `sprint_status` enum, both duration-settings procedures, the
  Settings "Sprint cadence" card, and the project-form duration input.

## Decisions (SOW §14, approved 2026-08-21)

| ID | Resolution |
|---|---|
| D1 | Supersede ADR 001 — this ADR records the supersession. |
| D2 | Cycles stay **per-project** in v1 (no workspace-level shared cycles). **Superseded by [ADR 003](003-global-weekly-cycles.md)** — cycles are now global, per-user domains. |
| D3 | Week boundaries are **UTC** (matches existing UTC-noon date handling); scheduler cron schedules are UTC. Workspace timezone is future work. |
| D4 | Leads may set other contributors' rows (single-tenant, owner-only project access). |
| D5 | **Clean destructive migration** now; no data preservation (pre-production). |
| D6 | Contributor metrics + scheduled lifecycle: `planned → active` and review-pending flagging automated via **pg-boss** cron; week close remains manual. |

## Alternatives Considered

- **Keep durations as a configurable setting (ADR 001).** Rejected: variable
  durations break the fixed weekly rhythm and reintroduce cadence as a
  per-project knob. If multi-week demand ever emerges, model it as *grouping of
  weekly cycles*, preserving the Monday invariant.
- **Workspace-level cycles shared across projects.** Deferred to v2 (D2);
  v1 keeps cycles nested under a project.
- **Timezone-aware weeks.** Deferred (D3); v1 is UTC-based like the existing
  date-only convention.

## Consequences

- Cadence is calendar-driven and non-configurable; the Settings page explains
  the fixed rhythm instead of editing it.
- Deadline counting is in whole weeks (`weeksBetween` to the project's Sunday
  deadline), matching "how many weeks do we have left?" as the primary
  scheduling question.
- All week math lives in `src/lib/week.ts` (ISO-8601, UTC-noon normalized),
  shared by server and client; year-rollover edge cases (ISO week 53,
  Dec 31 / Jan 1) are covered there.
- The scheduler (`src/lib/scheduler.ts`, pg-boss) reuses `DATABASE_URL`; its
  `pgboss` schema is created on first start and is **outside** drizzle-kit
  migrations. Handlers share the same set-based transition code
  (`src/lib/cycle-lifecycle.ts`) as the read-time fallback, so cron and
  fallback never diverge. Missed crons self-heal (idempotent updates).
- Destructive migration is accepted pre-production (D5); rollback was
  documented in the now-removed `SCOPE_OF_WORK_WEEKLY_CYCLES.md` §10.

## Traceability

- Implements `docs/notes/PRINCIPLES.md:5` #2 (Reduce WIP) and #4 (Shorten Feedback
  Loops) — a fixed weekly cycle is a deliberate rhythm, not a setting.
- Implements the weekly-cycles plan in full (schema, lifecycle, scheduler,
  UI); see `src/db/schema/cycles.ts` and `src/lib/cycle-lifecycle.ts`.
- Telemetry: `sprint_*` events replaced by `cycle_created`,
  `cycle_updated`, `cycle_closed`, `cycle_contributor_set`, and
  `project_deadline_set`.