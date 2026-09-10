# Planner Q3

Planner Q3 is an opinionated project-management tool that turns project
management theory into enforced workflow. Its domain is built around the
mental model `Outcome → Scope → Sequence → Constraints → Feedback → Decisions
→ Completion` (`docs/notes/PRINCIPLES.md`) — every concept below exists to
make good project hygiene the path of least resistance. Work lives in
**projects** (finite, goal-directed efforts) and everything written is a
**Document** (ADR 004). Navigation is project-scoped: every workspace page
lives at `/{projectSlug}/…` or `/~` (ADR 006, plan 005).

## Language

### Work & scope

**Outcome**:
The concrete result a project means to have produced by its end
(`projects.outcome`). It anchors the `Outcome → Feedback` link and is the
entry point of the mental model. Distinct from any list of tasks — it names
*the* result the project should deliver.
_Avoid_: goal (the retired, weaker predecessor)

**Project**:
A finite, goal-directed effort a user runs toward a definition of done,
addressed in URLs by a per-user unique `slug` (`UNIQUE(createdBy, slug)`).
_Avoid_: workspace, campaign, epic

**Project Slug**:
The URL segment that addresses a project — `/{projectSlug}/…`. A per-user
unique, URL-safe `slug` derived from the project name via `slugify`
(`src/lib/slug.ts`), distinct from the internal `id` (uuid). Guarded against
reserved values (`RESERVED_PROJECT_SLUGS`: `~`, `api`, `login`, `settings`).
Renaming updates the slug; the old slug 404s (no redirect history, v1).
_Avoid_: workspace, url, path

**Project Status**:
The lifecycle of a project: `active | on_hold | completed` (`src/schemas/db/projects.ts`). Default `active`.
_Avoid_: state

**Definition of Done (DoD)**:
The observable, verifiable criteria that mark a project's work complete — the
tool's `Completion` gate. `projects.definitionOfDone` is non-null
(`NOT NULL DEFAULT ''`), so every row carries it; an empty value reads as
"not defined yet".
_Avoid_: acceptance, done criteria

**Deadline**:
A project-level target date, necessarily a Sunday (`CHECK EXTRACT(ISODOW)=7`), that a user reads as whole
weeks remaining. Advisory and soft — it constrains scheduling, never blocks.
`null` means no deadline.
_Avoid_: due date, target date

### Scope & navigation

**Workspace**:
The scoped subtree of the app under `/{projectSlug}/*` —
either a single project (`isMulti: false`) or all of a user's projects
together (`"~"`, Multi-Project). Provided as React context by
`WorkspaceProvider` and consumed via `useWorkspace()`
(`src/components/workspace.tsx`).
_Avoid_: org, team

**Scope**:
Which project the current URL addresses. The source of truth is the
`$projectSlug` route param; `"~"` is the reserved Multi-Project scope.
`planner:lastScope` in `localStorage` is only a preference hint for
unscoped/global pages — never a source of truth.
_Avoid_: selected project, active project

### Inbound & execution

**Signal**:
An inbound item (manual, GitHub, CI, or alert) that merits attention. A
signal arrives and ages; it is **not committed work** until triaged into a
task. Scoped to a user and optionally a project.
_Avoid_: potential issue, inbound request

**Signal Status**:
The lifecycle of a signal: `new | triaged | dismissed` (`src/schemas/db/tasks.ts`). `triaged` means converted to a task (`triagedAt` set); `dismissed` is an explicit discard.
_Avoid_: state (reserved for Documents only; tasks/signals/connections use `status` columns)

**Triaged**:
The transition of a signal to `triaged` status when converted into a task. The moment inbound becomes committed work.
_Avoid_: handled, assigned, processed

**Severity**:
The urgency of a signal: `info | warning | critical`. Advisory — it informs
triage priority, never execution order. Also reused in `bug_report` document `meta.severity`.
_Avoid_: priority, level

**Task**:
A unit of agent-executable work, usually derived from a triaged signal, run
through a server-guarded lifecycle (`queued → running → completed | failed |
cancelled`). A task is scoped to a user and optionally a project.
_Avoid_: job, work item

**Task Status**:
The server-guarded lifecycle of a task: `queued → running → completed | failed | cancelled`
(`failed → queued` on retry). Stored in the `status` column (`src/schemas/db/tasks.ts`).
`finishedAt` is set exactly when status is terminal (`completed|failed|cancelled`), enforced by DB `CHECK`, never by the client.
_Avoid_: state (documents-only; the task column is named `status`)

### Integration

**Connection**:
A user's linked external account (e.g., GitHub) that the tool uses to ingest
external data such as signals.
_Avoid_: integration

**Provider**:
The named external service a connection links to (GitHub, Google). A provider
is the service; a connection is the user's linked account on it.
_Avoid_: connection

**Connection State**:
The lifecycle of a connection: `connected | disconnected | expired | error`.
Stored in the `status` column (`src/schemas/db/connections.ts`); `expired` and `error` both require re-auth.
_Avoid_: state (documents-only; the column is named `status`)

### Documents

**Document**:
The single unit of written content in the product. Owned by one user,
identified by a per-user sequential `number`, carrying a `kind`, an MDX body,
and typed frontmatter (`src/schemas/db/documents.ts`, `src/schemas/schema.ts`).
A document equals a GitHub issue and equals an MDX file with frontmatter.
_Avoid_: page, note, ticket, article

**Kind**:
The declared type of a Document, selecting its frontmatter schema, list view,
and policies (`wiki` | `spec` | `bug_report` | `update` | `changelog` |
`release` | `deployment` | `action_log`). Kind changes presentation and
validation — never identity (`number` stable across kind changes). Extra `meta` validated per kind (e.g. `bug_report.severity`, `deployment.environment`, `release.tagName`, `spec.status`).
_Avoid_: category, content type

**Frontmatter**:
The typed metadata block at the top of a Document's MDX body, mirrored into
queryable columns (`title`, `labels`, `projectId`, `slug`). Validated by the Zod schema for its kind; kind-specific extras live in `meta`.
_Avoid_: properties, fields, metadata blob

**State**:
The issue-style lifecycle of a Document: `open` or `closed` (`closedAt` set on close). Closing is a
decision, not a deletion. Reopening is `closed→open`. Only Documents use `state`; tasks/signals/connections use `status` columns.
_Avoid_: status (reserved for tasks/signals/connections)

**Label**:
A free-form, user-scoped tag on a Document used for grouping and filtering. Array of `≤20` strings, each `1..50` chars. Enforced in Zod (`src/schemas/schema.ts`), not by DB `CHECK`.
_Avoid_: tag, topic

**Number**:
The per-user sequential identifier of a Document (`#42`). Allocated atomically from `document_counters` per user, `UNIQUE(createdBy, number)`. Stable,
human-quotable, never reused. Distinct from internal `id` (uuid).
_Avoid_: id (the uuid stays internal)

**Slug**:
The per-user, URL-safe, unique identifier of a Document, derived from the
title via `slugify` and `UNIQUE(createdBy, slug)`. Mirrored from the
frontmatter; routing does **not** depend on it — Documents are addressed by
their sequential `number` (`/documents/$number`).
_Avoid_: url, path

**Comment**:
Markdown discussion attached to a document (`document_comments`). One `authorId` per comment, `body 1..10_000` chars (Zod-only; DB column is free `text`).
_Avoid_: reply, note

**Event**:
An append-only timeline entry on a document (`document_events`): `opened | closed | reopened | labeled | unlabeled | renamed | commented`. Written transactionally with the mutation that caused it. Kinds are convention-only — the DB column is free `text` (no pgEnum/`CHECK`).
_Avoid_: activity, log