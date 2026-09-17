# ADR 006 — Project-Scoped URLs (`/:projectSlug/*` and `/~`)

**Date:** 2026-08-30
**Status:** Accepted
**Implements:** `docs/plan/005-project-scoped-urls.md` (slug URL scheme)
**Related:** [ADR 005 — Remove Weekly Cycles](005-remove-weekly-cycles.md) (the `cycles` concept this scheme superseded), `docs/CONTEXT.md` (Workspace / Scope / Project Slug)

## Context

Workspace pages (dashboard, documents, signals, tasks, …) were flat global
routes (`/dashboard`, `/documents`, `/signals`, …) with project scope kept in
`localStorage` (`SCOPE_STORAGE_KEY = "planner:scope"`). That made deep links,
refresh, and share meaningless: a bookmark to `/documents` lost which project
it belonged to, and two users' views could differ with no URL difference. The
navigation sidebar was scope-unaware, switching nav groups on a magic
`__settings` localStorage value.

Meanwhile Documents already had the right shape — a per-user unique `slug`
(`UNIQUE(createdBy, slug)`, `src/schemas/db/documents.ts`) — and Projects had
no URL-addressable identity at all beyond an opaque uuid `id`.

## Decision

Make the URL the source of truth for workspace scope.

- **One dynamic segment** `$projectSlug` under the auth-gated `(app)` group:
  `/{projectSlug}/*` addresses a single project and `/~/*` (reserved literal
  `"~"`) addresses Multi-Project — every project together. One set of page
  files serves both; no parallel route trees.
- **Projects get a per-user unique `slug`** (`UNIQUE(createdBy, slug)`,
  `projects.slug` in `src/schemas/db/projects.ts`), derived from `name` via
  `slugify` and guarded by `RESERVED_PROJECT_SLUGS` in `src/lib/slug.ts`.
  As implemented the reserved set is small: `~`, `api`, `login`, `settings`
  (the earlier plan 005 list shrank — project names that collide with other
  route prefixes simply can't collide because those prefixes are reserved at
  the `(app)` level). Slugs are collision-suffixed (`-2`, `-3`, …) on conflict.
- **Scope resolution lives in the layout**, not in per-page code:
  `src/routes/(app)/$projectSlug/route.tsx` resolves the slug with
  `projects.getBySlug` and provides `WorkspaceProvider` (`src/components/workspace.tsx`);
  children read `useWorkspace()` for `{ isMulti, project, projectId,
  projectSlug }` and filter list queries by `projectId` unless `isMulti`.
- **Navigation becomes slug-aware**: the `AppShell` (`src/components/layout/AppShell.tsx`)
  owns the shell — `AppSidebar` (desktop) project selector and the mobile
  `select` take `"~"` or a slug and router-navigate to `/$projectSlug/dashboard`;
  nav `to` strings are `/$projectSlug/…` with `params: { projectSlug }`. Nav
  item arrays live in `(app)/$projectSlug/route.tsx` (`navItems`) and
  `(app)/settings/route.tsx` (`settingsNavItems`).
- **Management stays unscoped** under `/settings/*` (`/settings/projects`,
  `/settings/account`, `/settings/evals`,
  `/settings/projects/new`, `/settings/projects/$projectId`) — per-user,
  not per-project (plan 005 §3.1, option **A**).
- **Hard redirects, not wrappers**: the flat legacy routes were never kept as
  302 wrappers. Bare `/{slug}` redirects to `/{slug}/dashboard`
  (`(app)/$projectSlug/index.tsx`); `/wiki` redirects to
  `/documents?kind=wiki`; unknown slugs render an in-shell "Project not found"
  alert with a link to `/settings/projects`.

> **Post-implementation delta (2026-09-09, refreshed 2026-09-10, prompt-templates rename 2026-09-12, signals removal 2026-09-17, releases/automations 2026-09-17):** the `/wiki → documents?kind=wiki` redirect and `insights/updates` pages no longer exist — workspace nav is 5 items (`navItems` in `src/routes/(app)/$projectSlug/route.tsx:27-33`: dashboard/documents/releases/monitor/tasks; `signals` removed with its `signals.*` API, `signals` table, and task `signalId` link; `automations.tsx` is a placeholder orphan not in nav). `monitor` is a placeholder route. Settings nav (`src/routes/(app)/settings/route.tsx:26-57`) now includes backed pages `account/analytics/evals/projects/machines/agents/skills/mcp-servers/prompt-templates/subagents/model-providers/version-source` plus unbacked `web-search/browsers/computer-control` with no files; `/settings/commands` redirects to `/settings/prompt-templates` (`src/routes/(app)/settings/commands.tsx:3-8`) and `promptTemplates.*` replaces the `commands.*` oRPC namespace; `analytics`/`evals` are explicit placeholders. `connections`/`insights` settings pages are gone (Connections remain as oRPC `connections.*` + `/api/connections.*` callbacks with no settings UI). `routeTree.gen.ts` is generated (`bun run gen:routes`); do not hand-edit.

## Deviations from plan 005

- Scope resolution is **client-side** (`useQuery` on `projects.getBySlug`
  inside the layout component, then `WorkspaceProvider`), not a server
  `beforeLoad` DB lookup; 404 shows as an in-shell alert rather than a router
  `notFound()`.
- The old `SCOPE_STORAGE_KEY` (`planner:scope`) is gone; a **preference hint**
  under `planner:lastScope` is written for unscoped/global pages to fall back
  to. The URL is still truth.
- `scripts/backfill-project-slugs.ts` was not needed (pre-production, seed
  data only).

## Consequences

- Deep-link, refresh, and share now round-trip scope; the URL is
  human-readable (`/adistack/documents/42`) and stable across copy/paste.
- `projects.slug` is mutable — renaming changes the URL and the old slug 404s
  in v1 (no history/redirect table yet).
- Settings/nav caution: current nav arrays use `/$projectSlug/…` (`$projectSlug/route.tsx:27-33`) and `/settings/…` (`settings/route.tsx:26-57`); bare unscoped `to` strings `/projects, /connections, /account, /evals` do not appear in nav — the real pages live under `/settings/*`.
- `~` can never be a project slug (reserved), and TanStack Router's literal
  precedence keeps room to split a literal `(app)/~` tree later without
  migration.

## Alternatives considered

- **Two parallel trees** (`(app)/~/…` literal + `(app)/$projectSlug/…`):
  rejected — duplicates every page file and drifts (plan 005 §4.1).
- **`projects.id` (uuid) in the URL**: rejected — opaque, unstable long-term,
  and inconsistent with the existing `documents.slug` pattern (plan 005 §4.2).
- **localStorage remains truth**: rejected — broke deep links and made
  refresh/SSR ambiguous (plan 005 §4.3).

## Traceability

- Implements `docs/plan/005-project-scoped-urls.md` in full.
- Adds glossary terms **Project Slug**, **Workspace**, **Scope** to
  `docs/CONTEXT.md`.
- Navigation now never mentions `cycles` (ADR 005 already removed the product
  concept); the weekly-period entity ADRs 002/003 remain historical record.