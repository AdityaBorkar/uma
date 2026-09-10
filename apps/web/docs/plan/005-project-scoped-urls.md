# Plan 005 — Project-Scoped URLs (`/:projectSlug/*` and `/~/*`)

**Status:** Implemented (2026-08-30) — memorialized in [ADR 006](../adr/006-project-scoped-urls.md)

> **Post-implementation delta (2026-09-09 audit):** workspace nav is intentionally down to 5 items (`navItems` in `$projectSlug/route.tsx`: dashboard/documents/monitor/signals/tasks) — `insights`, `updates`, `wiki`, and the `documents.tsx` layout were removed by design. Settings added `analytics/agents/machines/model-providers/version-source` (backed) plus dead/planned nav targets with no backing files (`skills/mcp/commands/subagents/web-search/browsers/computer-control`); `connections` and `insights` pages were removed. `routeTree.gen.ts` is gitignored via `*.gen.ts` (not committed). See AGENTS.md Project Structure.  
**Date:** 2026-08-25 (implemented 2026-08-30)  
**Author:** OpenCode (with @aditya)  
**Related:** `docs/CONTEXT.md`, `docs/STYLE_GUIDE.md`, `AGENTS.md`, [ADR 006](../adr/006-project-scoped-urls.md)

---

## Implementation Status

This plan shipped on **2026-08-30**; [ADR 006](../adr/006-project-scoped-urls.md)
memorializes the decision. The "Current State Analysis" (§2) below describes
the *pre-implementation baseline* — treat it as historical record.

**Delivered:** `projects.slug` + `UNIQUE(createdBy, slug)`; `projects.getBySlug`;
`src/lib/slug.ts` (`slugify`/`RESERVED_PROJECT_SLUGS`); `src/components/workspace.tsx`
(`WorkspaceProvider`/`useWorkspace`); the `(app)/$projectSlug/*` file tree
(including a `documents.tsx` layout); slug/`~` navigation in `AppShell` +
`AppSidebar` + the mobile selector; a `(app)/settings/route.tsx` shell that
renders `AppShell` in `isSettings` mode; global management kept under
`/settings/*` (§3.1 **A**).

**Implementation deltas vs this plan:**

- Scope resolution is **client-side** — `$projectSlug/route.tsx` runs a
  `projects.getBySlug` `useQuery` and renders `WorkspaceProvider`, instead of
  the server-first `beforeLoad` lookup in §7.1. Unknown slugs render an
  in-shell alert, not a router `notFound()`.
- Scope preference is `planner:lastScope` (written on scoped navigation);
  the old `SCOPE_STORAGE_KEY` (`planner:scope`) is gone. Unscoped pages fall
  back to the hint; the URL is truth (§4.3).
- No flat 302 wrappers were ever shipped (§6.2/§8): the scoped tree was built
  directly and the legacy flat routes were dropped. Redirects that do exist:
  bare `/{slug}` → dashboard, `/wiki` → `documents?kind=wiki`,
  `settings/insights.tsx` → `/~/insights`.
- Management pages live under `/settings/*` (`(app)/settings/route.tsx` backs
  the settings shell); nav `to` strings `/projects`, `/connections`, `/account`,
  `/evals` in the `projectNavItems`/`settingsNavItems` arrays have no backing
  file routes (see AGENTS.md gotcha).

---

## 0. Summary

Move the app from **flat global URLs** (`/dashboard`, `/documents`, … with project scope in `localStorage`) to **project-scoped URLs**:

- Single project selected: `/{projectSlug}/*` — e.g. `/adistack/dashboard`, `/adistack/documents/$number`
- Multi-project (all projects) selected: `/~/*` — e.g. `/~/dashboard`, `/~/documents`, `/~/signals`
- Global management stays unscoped: `/projects`, `/projects/new`, `/login`, `/api/*`

Scope is derived **from the URL**, not `localStorage`. The sidebar project switcher becomes a **navigation** (router push), with backwards-compatible redirects from old flat routes.

---

## 1. Goals / Non-Goals

**Goals**

- URL is the source of truth for workspace scope. Deep-link, refresh, and share preserve project context.
- `adistack` is a **project slug** (URL-safe, per-user unique), not the internal `projects.id` (uuid). Mirrors `documents.slug` pattern in `src/db/schema/documents.ts:88`.
- `/~` is the explicit multi-project scope (chosen over `/all` to avoid collision with real slugs and to echo `~` = home/all).
- No duplicate page implementations; one set of scoped pages handles both `/:projectSlug` and `/~`.

**Non-Goals (v1)**

- No org/team scoping. One user owns many projects; slug uniqueness is `UNIQUE(createdBy, slug)`.
- No slug history / redirects on rename in v1 (410 or 404 after rename is acceptable; history table is a follow-up). Note: the `cycles` concept was removed from the product entirely (ADR 005).

---

## 2. Current State Analysis

| Area | Today | Ref |
|---|---|---|
| **Routes** | Flat under `src/routes/(app)/*`: `dashboard.tsx`, `documents/*`, `signals.tsx`, `tasks.tsx`, `projects/index.tsx`, `projects/new.tsx`, `projects/$projectId/index.tsx`; generated tree in `src/routeTree.gen.ts` | `src/routes/(app)/route.tsx:44`, `src/routeTree.gen.ts:1` |
| **Project identity** | `projects` has `id` (uuid), `name`, no slug | `src/db/schema/projects.ts:1` |
| **Scope state** | `SCOPE_STORAGE_KEY = "planner:scope"` in `localStorage`, values `__multi`, `__settings`, or `projectId` (uuid). Sidebar + mobile selector drive it; nav `items` switch on `selectedScope === "__settings"` | `src/routes/(app)/route.tsx:85`, `src/components/layout/AppSidebar.tsx:99` |
| **Documents** | Already have `slug` + per-user unique index `documents_user_slug_uidx`, generated via `slugify` + `uniqueSlug` | `src/db/schema/documents.ts:98`, `src/orpc/router/documents.ts:61` |
| **Router** | TanStack Start file-router, pathless `(app)` group is auth-gated (`beforeLoad` calls `getServerSession` + client `authClient.useSession` fallback). `bun run gen:routes` regenerates `routeTree.gen.ts` | `AGENTS.md`, `src/router.tsx:10` |

**Key gap:** no `projects.slug`, no URL param, all scoped pages assume global context. Every `Link to="/dashboard"` etc. will need to become scoped.

---

## 3. Desired URL Scheme

```
# Scoped workspace (auth-gated, via (app) group)
/~/*                multi-project — every project together
/{slug}/*           single-project — e.g. /adistack/*

# Under either scope, same child routes:
  /dashboard
  /documents         (DocumentsPage — kind tabs, search; filtered by projectId when slug scope)
  /documents/new
  /documents/$number
  /documents/$number/edit
  /signals
  /tasks
  /monitor
  /wiki              (redirects to /documents?kind=wiki today — keep)
  /insights
  /updates
  /settings          (workspace settings — keep as scoped or move to global? see §3.1)
  /account           (could stay global)

# Global (unscoped, remains at root inside (app) but outside the scope param)
  /projects          project list / management
  /projects/new
  /projects/$projectId  (legacy detail; after slug, this could redirect to /{slug}/dashboard)
  /connections
  /evals

# Public
  /                  marketing/home
  /login

# API (unchanged)
/api/* , /api/rpc/* , /api/auth/*, /api/connections/*
```

**Examples**

- User picks `adistack` (slug `adistack`) → sidebar selector navigates to `/adistack/dashboard`; NavLinks become `/adistack/documents`, `/adistack/signals`, etc.
- User picks Multi-Project → navigates to `/~/dashboard`; same pages but with `projectId` filter omitted.
- Direct hit to `/adistack/documents/42` → server resolves `createdBy + slug=adistack` → projectId `abc…` → documents query adds `projectId` filter (or validates doc belongs to that project).
- Old bookmark `/dashboard` → 301/302 to `/~/dashboard` (or last-used scope if we store preference — recommend deterministic `/~/dashboard` for predictability).

### 3.1 Open Decision: where does `/settings` live?

Today `settingsNavItems` are shown when `selectedScope === "__settings"` and nav switches via `isSettingsScope` (`src/routes/(app)/route.tsx:182`). With URL scoping, two options:

- **(A) Keep settings global** at `/settings` (and `/connections`, `/account`) outside the scope param. Simplest; settings are per-user, not per-project.
- **(B) Make settings scoped** so `/adistack/settings` vs `/~/settings` differ (e.g. project-specific settings later).

**Recommendation:** (A) for v1 — leave `/settings`, `/connections`, `/account`, `/projects` unscoped. Nav config becomes explicit: scoped nav vs global nav, no magic `__settings` scope value. Revisit if project-level settings appear.

**Resolved:** (A) shipped. Management is unscoped under `/settings/*`
(`/settings/projects`, `/settings/connections`, `/settings/account`,
`/settings/evals`); `settings/index.tsx` backs `/settings` and
`settings/insights.tsx` redirects to `/~/insights`. The `AppSidebar` retains
a `__settings`/`__multi` pseudo-value in its selector purely to drive
navigation runs, not scope logic.

---

## 4. Design Decisions

### 4.1 One param, `~` as reserved value

- **Chosen:** single dynamic segment `$projectSlug` under `(app)`, where the literal value `"~"` means multi-project. One set of scoped page files; branching in the layout loader.
- **Alternative considered:** two parallel trees `src/routes/(app)/~/...` (literal) + `src/routes/(app)/$projectSlug/...` (param) — rejected because it duplicates every page file or forces re-exports that drift.
- **Why one param wins:** less codegen, one place to add a page, correct TanStack Router precedence still works (literal `~` could coexist if we later split, no migration).
- **If we later want different multi vs single layouts,** we can introduce `(app)/~` as a literal sibling; TanStack Router prefers literal over param so `/~/dashboard` would then match the literal tree.

### 4.2 Slug, not id, in the URL

- Follows existing document slug pattern (`documents.slug` `UNIQUE(createdBy, slug)`). Keeps URLs human-readable and stable across copy/paste. `id` stays internal (uuid).
- Uniqueness scope: per-user (`UNIQUE(createdBy, slug)`), not global. Two users can both have `adistack`.
- Slug mutability: allow rename (updates slug), but old slug immediately 404s in v1. No redirect history table yet.

### 4.3 URL is truth, storage is cache only

- Remove `SCOPE_STORAGE_KEY` as source of truth (`src/routes/(app)/route.tsx:85`). After migration, it may remain as a **preference hint** for redirecting `/` or bare `/dashboard` → last-used scoped URL, but navigation/queries read `params.projectSlug`.
- SSR must resolve slug on the server (`getServerSession` + DB lookup) so first paint is correct.

---

## 5. Data Model Changes

### 5.1 DB: `projects.slug`

In `src/db/schema/projects.ts`:

```ts
export const projects = pgTable("projects", {
  // ...existing
  slug: text("slug").notNull(), // NEW
}, (t) => [
  index("projects_createdBy_idx").on(t.createdBy),
  uniqueIndex("projects_user_slug_uidx").on(t.createdBy, t.slug), // NEW
]);
```

- **Constraints:** `slug` lowercased `a-z0-9-`, `2..60` chars (align with `ProjectCreateInput` `name: 2..100` but slug shorter), must not start/end with `-`, no `--`.
- **Reserved slugs** (case-insensitive, never allocatable): `~`, `api`, `login`, `projects`, `documents`, `signals`, `tasks`, `dashboard`, `monitor`, `insights`, `evals`, `updates`, `wiki`, `settings`, `connections`, `account`, `new`, `~` already covers multi. Return `BAD_REQUEST` on create/update if requested slug is reserved.
- **Generation:** `slugify(name)` borrowed from `src/orpc/router/documents.ts:61` (trim, lower, replace non-alnum, collapse `-`, trim `-`). On collision for same `createdBy`, suffix `-2`, `-3` … (same logic as `uniqueSlug` in `src/orpc/router/documents.ts:70`). Expose `generateProjectSlug(userId, name)` server helper.
- **Backfill:** for existing rows, `slug = uniqueSlugForProject(userId, name)` per user. If `name` slugifies to empty (e.g. "!!"), fallback to `project-${id.slice(0,8)}`.
- **Index:** add `uniqueIndex` as above; no full-text index needed.

### 5.2 oRPC / Zod

In `src/orpc/schema.ts`:

- Extend `ProjectSchema` with `slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`.
- Extend `ProjectCreateInput` with optional `slug?` (if absent, derive from `name`; if provided, validate + uniquify).
- Extend `ProjectUpdateInput` to allow `slug?` change (v1: allowed, with note about breaking old URLs).
- Add `ProjectGetBySlugInput = z.object({ slug: z.string() })` for the layout loader.
- No change to `documents`/`signals`/`tasks` schemas except their `list` handlers will accept `projectId` resolved from slug.

In `src/orpc/router/projects.ts`:

- `create`: accept `slug`, derive if missing, call `uniqueSlugForProject`, insert.
- `getBySlug`: new procedure `getBySlug` (`os.input(z.object({ slug: z.string() }))`) that looks up `where eq(slug) && eq(createdBy, user.id)`.
- `update`: if `slug` supplied, validate reserved list, uniquify, update; else keep existing.
- `list`: return `slug` alongside `id/name` so sidebar can build `{id, name, slug}` options.

### 5.3 Env / Config

No new env vars. Adding `slug` is internal; `src/env.ts` unchanged.

---

## 6. Router Structure (File-Router)

### 6.1 Proposed file tree (delta)

```
src/routes/(app)/
  route.tsx                         # unchanged auth guard (beforeLoad getServerSession)
  # --- Global (unscoped) pages stay at root ---
  projects/
    index.tsx                       # /projects  (list)
    new.tsx                         # /projects/new
    $projectId/
      index.tsx                     # legacy detail — keep but add redirect to /{slug}/dashboard (see §8)
  settings.tsx                      # /settings  (global)
  connections.tsx                   # /connections
  account.tsx
  evals.tsx
  # --- Scoped workspace ---
  $projectSlug/
    route.tsx                       # NEW: scope layout — resolves "~" vs slug, provides context, handles 404
    dashboard.tsx                   # /$projectSlug/dashboard  (moved from /(app)/dashboard.tsx)
    documents.tsx                   # layout Outlet (from current documents.tsx)
    documents/
      index.tsx                     # /$projectSlug/documents
      new.tsx
      $number.tsx
      $number.edit.tsx
    signals.tsx
    tasks.tsx
    monitor.tsx
    insights.tsx
    updates.tsx
    wiki.tsx                        # keep redirect to ../documents?kind=wiki (relative)
    # settings as scoped is optional; if global, do not duplicate here
```

`tsr.config.json` needs no change. After moves, run `bun run gen:routes` (`AGENTS.md`) to regenerate `src/routeTree.gen.ts` (gitignored `*.gen.ts`).

**Why `$projectSlug` under `(app)`:** `(app)` is pathless (`id: '/(app)', path: ''` in `routeTree.gen.ts:48`), so `/(app)/$projectSlug/dashboard` becomes `/$projectSlug/dashboard` in URLs — exactly what the spec wants (`/adistack/dashboard`, `/~/dashboard`). No extra prefix.

### 6.2 Alternative layout if we want to keep flat files during migration

Keep existing flat files as thin re-export/redirect wrappers for one release while new scoped files are authoritative. Example `src/routes/(app)/dashboard.tsx` would become:

```ts
export const Route = createFileRoute("/(app)/dashboard")({
  beforeLoad: () => { throw redirect({ to: "/~/dashboard" }); }
});
```

Prevents link rot; remove wrappers after one release.

### 6.3 Route params & validation

- `$projectSlug` param: `z.string().min(1).max(60)` plus custom check that it is either `"~"` or matches `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Invalid slug → 404 page (not 500).
- `beforeLoad` in `$projectSlug/route.tsx` must **await** project resolution before rendering children, so every child can `useWorkspace()` synchronously.

---

## 7. Scope Resolution & Context

### 7.1 Layout loader (`src/routes/(app)/$projectSlug/route.tsx`)

Pseudocode:

```ts
export const Route = createFileRoute("/(app)/$projectSlug")({
  beforeLoad: async ({ params, context }) => {
    const session = await getServerSession(); // reuse existing pattern from (app)/route.tsx:47
    if (!session) throw redirect({ to: "/login" });
    if (params.projectSlug === "~") return { workspace: { scope: "~" as const, project: null } };
    // lookup by slug scoped to user
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.createdBy, session.user.id), eq(projects.slug, params.projectSlug))
    });
    if (!project) throw notFound(); // render 404 inside (app) shell
    return { workspace: { scope: "single" as const, project } };
  },
  component: WorkspaceLayout,
});
```

`WorkspaceLayout` provides React context:

```ts
// src/lib/workspace.tsx
type Workspace = { scope: "~" } & { project: null }
              | { scope: "single", project: { id: string; slug: string; name: string } };
const WorkspaceContext = createContext<Workspace>(...);
export function useWorkspace() { return useContext(WorkspaceContext); }
```

**As implemented (ADR 006):** the `$projectSlug/route.tsx` layout performs the
resolution **client-side** — a `useQuery` on `orpc.projects.getBySlug` (enabled
when `projectSlug !== "~"`), then renders `WorkspaceProvider`. The actual
`WorkspaceValue` shape is `{ isMulti, project, projectId, projectSlug }`
(`src/components/workspace.tsx`); unknown slugs produce a loading skeleton, then an
in-shell "Project not found" `Alert` with links to `/settings/projects` and
`/~/dashboard` — not a router `notFound()`. Scope preference is persisted as
`planner:lastScope`.

- **SSR:** `beforeLoad` runs on server via TanStack Start; DB pool from `src/db/index.ts` already merges auth schema.
- **Client navigation:** same `beforeLoad` runs client-side; `orpc.projects.getBySlug` could alternatively be used client-side, but `beforeLoad` server-first is preferred for SEO/404 correctness.
- **Caching:** `queryClient` from `src/router.tsx:10` + `setupRouterSsrQueryIntegration` — scope lookup should also be a `useQuery` keyed by `["workspace", slug]` for client cache, but `beforeLoad` return is authoritative.

### 7.2 Filtering semantics per page

- **Multi (`~`):** pages query without `projectId` filter. Example `orpc.documents.list` called with no `projectId` → all docs for user.
- **Single (`adistack`):** derive `projectId = workspace.project.id`, pass to every list/create query: `documents.list({ projectId })`, `signals.list`, `tasks.list`, `documents.create({ projectId })`. UI should show a subtle banner "Showing only adistack — switch to Multi-Project to see all" where relevant.

### 7.3 Navigation helpers

Create `src/lib/routes.ts`:

```ts
export function scopedTo(scope: string, to: string) {
  // scope is "~" or slug
  return `/${scope}${to}` as const; // to already starts with "/"
}
export function projectHref(project: { slug: string }, to: string) {
  return `/${project.slug}${to}`;
}
```

Update every `Link to="/dashboard"` → `Link to={scopedTo(slug, "/dashboard")}` or use `useWorkspace().scope`. Codemod scope: grep `to="/(dashboard|documents|signals|tasks|monitor|insights|updates|wiki|settings)"` (58 `createFileRoute` sites).

**As implemented (ADR 006):** `src/lib/routes.ts` was **not** created. The
plan's and the nav's `to` strings are the literal `/ $projectSlug/…` route
paths with `params: { projectSlug }` supplied from `useWorkspace()` /
`currentScope`, so no helper indirection is needed.

AppSidebar change (`src/components/layout/AppSidebar.tsx`):

- Remove `onSelectScope` localStorage mutation; selector becomes navigation:

```ts
function handleSelectChange(value: string) {
  if (value === "__create") { setCreateOpen(true); return; }
  // value is now slug or "~"
  const next = value === "__multi" ? "~" : projects.find(p => p.id === value)?.slug ?? "~";
  navigate({ to: `/${next}/dashboard` });
}
```

But `projects` passed to sidebar must now carry `slug`. Map `orpc.projects.list` → `{id, name, slug}`.

---

## 8. Redirects & Backwards Compatibility

| Old URL | New handling | Status |
|---|---|---|
| `/dashboard` | redirect → `/~/dashboard` | 302 (temporary, until we remove wrapper) |
| `/documents`, `/documents/new`, `/documents/$number` | redirect → `/~/documents…` | 302 |
| `/signals`, `/tasks`, `/monitor`, `/insights`, `/updates`, `/wiki` | redirect → `/~/…` | 302 |
| `/projects/$projectId` (legacy uuid detail) | redirect → `/{slug}/dashboard` if project exists, else 404 | 302 |
| `/{slug}` (bare, no child) | redirect → `/{slug}/dashboard` | 302 |
| `/~/` (bare) | redirect → `/~/dashboard` | 302 |
| Unknown `/{slug}/*` | render 404 inside `(app)` shell: "Project not found — check slug or go to /projects" | 404 |

Implementation: keep old flat route files as `beforeLoad: () => { throw redirect({ to: "/~/dashboard" }) }` wrappers during migration, or a single catch-all redirect route. Prefer wrappers so `routeTree.gen.ts` still lists them for type safety.

**SEO:** flat routes emit `rel=canonical` pointing to `/{slug}/*`? Not needed for authenticated app (no crawl), but keep `robots: noindex` if any public.

---

## 9. UI Changes

- **AppSidebar** (`src/components/layout/AppSidebar.tsx:99`): swap `value` from `projectId` to `slug`; multi value is `"~"` not `"__multi"`; display label from `projects.find(p => p.slug === scope)`.
- **Mobile selector** (`src/routes/(app)/route.tsx:236`): same change; value=`"~"` / `slug`.
- **Header search placeholder** (`src/components/layout/Header.tsx:25`): unchanged.
- **Workspace banner:** in `$projectSlug/route.tsx` show header `adistack · active` with link to project settings, plus quick switcher back to `~`.
- **Breadcrumbs:** project detail page now lives at `/{slug}/dashboard` not `/projects/$projectId`. Keep `/projects` as the project directory (GitHub-style: list at `/projects`, workspace at `/{slug}`).
- **Style:** follow `docs/STYLE_GUIDE.md` — Box/border, `AppShell`/`AppSidebar`, `UnderlineNav` `#fd8c73` active border. *(Superseded on the shell point: desktop uses `AppSidebar` + mobile selector bar/`UnderlineNav`, both rendered by `AppShell` — see STYLE_GUIDE's "Layout (App Shell)".)*

---

## 10. Implementation Phases

> All phases are **complete** as of 2026-08-30 (see Implementation Status and
> ADR 006). Checkboxes below reflect what shipped; items marked *n/a* never
> shipped by design.

### Phase 0 — Prep (no user-facing change)
- [x] Add `slug` to `ProjectSchema` / `ProjectCreateInput` / `ProjectUpdateInput` + `ProjectGetBySlugInput` in `src/orpc/schema.ts`
- [x] Add slug helpers — `slugify`/`slugifyProject`/`RESERVED_PROJECT_SLUGS` in `src/lib/slug.ts` + `uniqueProjectSlug` in `src/orpc/router/projects.ts`
- [x] Add `slug` column + `uniqueIndex("projects_user_slug_uidx")` to `src/db/schema/projects.ts`; `db:push` in dev
- [~] Write backfill script `scripts/backfill-project-slugs.ts` — *n/a:* pre-production, no real data; `scripts/seed.ts` writes slugs directly
- [x] Add `projects.getBySlug` procedure in `src/orpc/router/projects.ts`
- [x] Add `src/components/workspace.tsx` (`WorkspaceProvider`/`useWorkspace`) + `src/lib/slug.ts`
- [~] Add unit helpers for reserved list + slugify — *n/a:* no test runner; helpers live in `src/lib/slug.ts`

### Phase 1 — Scoped routing skeleton
- [x] Create `src/routes/(app)/$projectSlug/route.tsx` (client-side `projects.getBySlug` query + `WorkspaceProvider` + `Outlet`)
- [x] Move `dashboard.tsx` → `$projectSlug/dashboard.tsx` (wired to `useWorkspace`)
- [~] Keep old `/(app)/dashboard.tsx` as 302 redirect — *n/a:* scoped tree built directly; legacy flat files were dropped, never wrapped
- [x] `AppSidebar` + mobile selector navigate by `"~"`/slug; projects query returns `slug`
- [x] `bun run gen:routes`; verify `/(app)/$projectSlug/…` tree and `~` handling
- [x] `bun run check:lint` (Biome)

### Phase 2 — Migrate remaining pages
- [x] Move `documents/*` (+ `documents.tsx` layout), `signals`, `tasks`, `monitor`, `insights`, `updates`, `wiki` into `$projectSlug/`
- [x] Scope-aware `Link to="/$projectSlug/…"` with `params: { projectSlug }` everywhere
- [x] Project filtering: `documents.list`/`signals.list`/`tasks.list` pass `projectId` when `!isMulti`
- [x] `documents/new.tsx` preselects `projectId = ws.projectId` when single scope
- [x] Search validation under the param route (`validateSearch` on signals/tasks pages)

### Phase 3 — Global routes & redirects
- [x] Settings placement **A**: management stays unscoped at `/settings/*` (see §3.1)
- [~] Flat scoped wrappers → 302 — *n/a:* none existed (see Phase 1)
- [~] `/projects/$projectId` → `/{slug}/dashboard` redirect — *n/a:* the uuid detail page lives on as `/settings/projects/$projectId` (management, not workspace)
- [x] Bare `/$projectSlug` → `/$projectSlug/dashboard` (`index.tsx`) and `/~` → `/~/dashboard`

### Phase 4 — Hardening & polish
- [x] Remove `SCOPE_STORAGE_KEY` (`planner:scope`) localStorage logic; `planner:lastScope` kept as a hint for unscoped/global pages
- [x] `docs/CONTEXT.md`: add **Project Slug**, **Workspace**, **Scope**; **Project** mentions slug uniqueness
- [x] Write ADR memorializing the decision — [ADR 006](../adr/006-project-scoped-urls.md) (number went to 006 because ADR 005 is *Remove Weekly Cycles*)
- [x] Update `AGENTS.md` Project Structure tree
- [x] Manual QA: auth redirect, unknown slug 404, slug collision on create, rename slug flow, deep-link refresh, back/forward

### Phase 5 — Cleanup
- [~] Delete flat redirect wrapper files — *n/a:* no wrappers were ever shipped
- [ ] Route tests / `routeTree.gen.ts` snapshot check — open (no test runner adopted yet)
- [ ] Slug-history table for rename UX — open, only if rename UX demands it

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Slug collision** (`"My Project"` and `"my-project"` same slug) | Create fails or wrong project resolves | `uniqueSlugForProject` with `-2` suffix; DB `UNIQUE(createdBy, slug)` as guard; friendly error "Slug already taken, suggested: my-project-2" |
| **Reserved slug conflict** (user names project "api") | Route would shadow `/api/*` | Reserved list + validation at create/update; error message "Slug `api` is reserved" |
| **Old bookmarks / external links 404** | User loses deep links | §8 redirect table; keep wrappers for one release; log 404 slugs for follow-up |
| **TanStack Router file-router gotchas** (`~` is not a valid identifier) | Literal `~` folder may need escaping | If literal folder fails, use `$projectSlug` param only and treat `"~"` as value; file name `~` is allowed on Linux but verify codegen — fallback to `$scope` param if needed |
| **SSR slug lookup cost** | Every scoped navigation hits DB | Cache lookup by `(createdBy, slug)` in layout loader's query cache; DB index makes it cheap; consider edge caching later |
| **Type drift** (routes renamed but `Link to=` strings stale) | Compile fails or runtime 404 | `bun run gen:routes` regenerates `routeTree.gen.ts`; `Link to=` is typed via `FileRoutesByTo` — TS will error on stale paths; run `tsc --noEmit` in CI |

---

## 12. Detailed File Checklist (for implementer)

**Schema / lib**
- `src/db/schema/projects.ts` — add `slug` column + `uniqueIndex`
- `src/lib/slug.ts` — NEW: extract `slugify` + `uniqueSlug` (shared by projects + documents)
- `src/lib/workspace.tsx` — NEW: `WorkspaceContext`, `useWorkspace()`, `resolveWorkspace(slug, userId)`
- `src/orpc/schema.ts` — extend `Project*` schemas with `slug`
- `src/orpc/router/projects.ts` — `getBySlug`, `create`/`update` slug handling, `list` returns `slug`

**Routes — new**
- `src/routes/(app)/$projectSlug/route.tsx` — scope layout (the only new layout)
- `src/routes/(app)/$projectSlug/dashboard.tsx`
- `src/routes/(app)/$projectSlug/documents.tsx` + `documents/index.tsx`, `new.tsx`, `$number.tsx`, `$number.edit.tsx`
- `src/routes/(app)/$projectSlug/signals.tsx`
- `src/routes/(app)/$projectSlug/tasks.tsx`
- `src/routes/(app)/$projectSlug/monitor.tsx`
- `src/routes/(app)/$projectSlug/insights.tsx`
- `src/routes/(app)/$projectSlug/updates.tsx`
- `src/routes/(app)/$projectSlug/wiki.tsx`

**Routes — modified**
- `src/routes/(app)/route.tsx` — remove `SCOPE_STORAGE_KEY` logic, pass `projects` with `slug`, update nav to use slugs
- `src/components/layout/AppSidebar.tsx` — navigate by slug, value="~" for multi
- `src/routes/(app)/projects/*` — keep but add `slug` display + redirect for `$projectId`

**Routes — temporary wrappers (phase 3) then deleted**
- `src/routes/(app)/dashboard.tsx`, `signals.tsx`, `tasks.tsx`, `documents/*`, etc. — become `throw redirect({ to: "/~/…" })`
- *n/a as implemented:* no wrapper files were ever created (see Implementation Status — the scoped tree was built directly and legacy flat files were dropped).

**Docs**
- `docs/adr/006-project-scoped-urls.md` — ADR memorializing decision (implemented; ADR 005 is *Remove Weekly Cycles*)
- `docs/CONTEXT.md` — Project Slug / Workspace / Scope terms (added)
- `docs/plan/005-project-scoped-urls.md` — this file (status: Implemented)

---

## 13. Verification Plan

- **Static:** `bun run gen:routes` + `tsc --noEmit` passes; `bun run check:lint` clean (Biome `2.5.11`, `indentStyle: space`, `quoteStyle: double` per `biome.json`)
- **Manual:**
  - Create project "adistack" → slug `adistack` → redirected to `/adistack/dashboard` after create
  - Direct-hit `/adistack/dashboard`, `/adistack/documents`, `/~/dashboard` → correct filtering
  - Switcher Multi → `/~/dashboard` shows all docs; Single → only that project's docs
  - Refresh on `/adistack/signals` → SSR correct, no flash of multi
  - Hit old `/dashboard` → 302 to `/~/dashboard`
  - Hit unknown `/does-not-exist/dashboard` → 404 with CTA to `/projects`
  - Rename project slug `adistack` → `adistack2` → old URL 404 (expected v1), new URL works
- **DB:** `SELECT slug, name FROM projects WHERE createdBy = $1` shows unique slugs per user; duplicate slug insert fails with `UNIQUE` violation mapped to 409 via oRPC error.

---

## 14. Open Questions for @aditya

Resolved during implementation (2026-08-30):

1. **Settings placement:** global (`/settings`) vs scoped (`/{slug}/settings` + `/~/settings`)? → **Global** under `/settings/*` (option A).
2. **Bare `/{slug}` landing:** dashboard vs project overview? → **Dashboard** (`$projectSlug/index.tsx` redirects).
3. **`__settings` nav:** Switchable nav group in `AppSidebar` vs separate top-level link? → **Kept as a selector pseudo-value** (`__settings`/`__multi`); selecting it navigates, it no longer decouples nav groups.
4. **Slug rename UX:** allow slug edit on `/{slug}/settings`? → **Yes** via `projects.update({ slug })`; no history redirects in v1 (renamed slug 404s).
5. **Multi-project symbol:** `~` chosen — confirmed it renders and is encoded correctly in practice.

Still open:

- Slug rename history / redirect table (only if rename UX demands it).
- Route tests or `routeTree.gen.ts` snapshot (blocked on a test runner).

---

## 15. Next Step

If this plan looks good, implementation starts at **Phase 0** (slug column + oRPC) in a feature branch `feat/project-scoped-urls`. No existing pages are moved until the skeleton route + one pilot page (`dashboard`) is verified in review.

