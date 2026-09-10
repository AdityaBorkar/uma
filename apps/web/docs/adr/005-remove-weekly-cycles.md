# ADR 005 — Remove Weekly Cycles

**Date:** 2026-08-30
**Status:** Accepted
**Supersedes:** [ADR 002 — Weekly Cycles](002-weekly-cycles.md) and [ADR 003 — Global (Per-User) Weekly Cycles](003-global-weekly-cycles.md)

## Context

ADR 002 replaced sprints with fixed **Monday → Sunday weekly cycles**
(`weekly_cycles`, `cycle_contributors`, the `cycle_status` enum), and ADR 003
made those cycles global, per-user domains. The product has since been
simplified: the weekly planning period as a first-class entity is being
removed entirely. Planning becomes implicit — work is scoped to a **project**,
written down as **Documents** (ADR 004), and triaged from **Signals** into
agentic **Tasks**. Nothing in the product needs an explicit "cycle" row
anymore.

Repo maturity (pre-production, no real user data) permits a clean,
destructive removal.

## Decision

Remove the weekly-cycles concept from every layer of the application:

- **Drop the tables** `weekly_cycles`, `cycle_contributors`, and the
  `cycle_status` enum. `drizzle.config.ts` and `src/db/schema.ts` no longer
  reference `src/db/schema/cycles.ts` (file deleted).
- **Drop the `cycleId` columns** from `documents` and `tasks` (and their
  `weekly_cycles` foreign keys), including all reads/writes in the
  `documents.*` and `tasks.*` procedures and their Zod schemas.
- **Delete the `cycles.*` oRPC namespace**, the `/cycles` routes
  (`/../$/projectSlug/cycles`, `/cycles/$cycleId`), the
  `src/components/cycles/*` UI, and the "Cycles" nav item / project-detail
  shortcut. "Cycles" is also removed from `RESERVED_PROJECT_SLUGS`.
- **Delete the scheduler**: `src/lib/scheduler.ts` (pg-boss)
  and `src/lib/cycle-lifecycle.ts` (`activateDueCycles` / `findReviewPending`)
  existed only to drive cycle status transitions; the read-time fallback is
  gone with them. `pg-boss` is removed from `package.json`.
- **Trim `src/lib/week.ts`** to the generic week math still used (ISO-week
  `mondayOf`/`toDateOnly`, used by the Updates page's week grouping). Cycle
  helpers (`isoWeekKey`, `sundayOf`, `addWeeks`, …) are deleted.
- **Keep** the product-level `projects.outcome` (the glossary's **Outcome**
  entry now scopes to projects) and the *project* **Deadline** (Sunday
  target, unchanged). The flow-metric term **cycle time** in
  `docs/notes/REFERENCE.md` (Kanban, domain D) is unrelated to weekly cycles
  and stays.
- **Update `docs/CONTEXT.md`, `AGENTS.md`, `docs/STYLE_GUIDE.md`, and
  `docs/plan/005-project-scoped-urls.md`** so they no longer describe a
  cycles concept.

## Consequences

- The DB is cleaner: `weekly_cycles`/`cycle_contributors` and their FKs are
  gone; `db:push` (or a fresh `docker compose up -d && bun run db:push`)
  drops them.
- No background jobs remain; the `/api` and `/api/rpc` handlers no longer call
  `ensureScheduler()`.
- No URL path, nav label, or copy mentions cycles anywhere in the app.
- Historical ADRs 002/003 remain on record (marked superseded); this ADR
  documents the reversal, the same pattern ADR 001 used.

## Alternatives Considered

- **Keep cycles dormant (schema + procedures, no UI).** Rejected: the concept
  was undeployed and unused; dormant code and tables would add surface area
  with no caller, contradicting "remove the concept entirely".
- **Keep a scheduler shell for future jobs.** Rejected as YAGNI; pg-boss can
  be re-added with an ADR when a real recurring job exists.

## Traceability

- Reverses ADR 002 (schema, lifecycle, scheduler, telemetry) and ADR 003
  (global cycles, `cycle_contributors`, top-level `/cycles` surface).
- Splits the difference on the mental model: `Outcome` survives at the
  project level; the fixed weekly *period* is removed as an entity.