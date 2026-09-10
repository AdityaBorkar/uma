# Style Guide — GitHub-like Layout (Primer)

Planner Q3 mirrors GitHub’s Primer design system: **border, not shadow; bundled variable fonts; UnderlineNav; Box; Label/StateLabel; Blankslate; Timeline**. This is the single source of truth for layout, tokens, and component usage.

## Principles

- **Content first** — filters and tables live in bordered Boxes, not floating Cards with shadows.
- **Border over shadow** — `rounded-md border` (`--radius 6px`) + `border: #d0d7de` (light) / `#30363d` (dark). No `shadow-sm/xl`.
- **Bundled variable fonts** — Schibsted Grotesk Variable for sans, JetBrains Mono Variable for code, both via `@fontsource-variable/*` (self-hosted, no Google Fonts / no network).
- **Text + color** — never color alone. Badges/StateLabels include text and pass contrast.
- **One shell** — the `AppShell` component (`src/components/layout/AppShell.tsx`) renders exactly one shell per viewport, swapped at `md:`, never both. Desktop (`md+`): `AppSidebar` (project selector, nav — no brand mark, chat actions, or user footer as committed) beside centered content (`max-w-[1280px] px-4 sm:px-6`). Mobile: project selector bar → sticky `UnderlineNav` → content (no dark header; the sidebar is hidden).

## Layout (App Shell)

The shell is `AppShell` (`src/components/layout/AppShell.tsx`): it derives the
current scope (matched `$projectSlug` param, else pathname + `planner:lastScope`
hint), renders `AppSidebar` on `md+` and a mobile selector bar + `UnderlineNav`
below `md`, and hosts the "Create project" dialog. There is no global footer.

Desktop (`md+`) — `AppSidebar` (sticky, fixed 280px) + content column:

```
AppSidebar (sticky top-0 h-screen w-[280px] border-r, hidden below md)
  project selector: Base UI Select — Settings · Global Workspace (~) · per-project slugs
  nav: items prop (navItems / settingsNavItems)
  (no brand P-mark block, no chat actions, no avatar/user footer as committed)
Main (mx-auto max-w-[1280px] px-4 py-6 sm:px-6)
  Page header → Filters Box → Content Box → (optional) Timeline aside
```

Mobile (below `md`) — selectors + `UnderlineNav`, rendered by `AppShell`:

```
Project selector bar (border-b bg-muted/50 px-4 py-2, native select)
  Multi-Project · per-project slugs · Create Project
UnderlineNav (sticky top-14 z-30, bg-background, border-b, scroll-x, hides scrollbar)
  tabs: current nav items (items prop)
  active: text-foreground font-semibold border-b-2 border-[#fd8c73]
Main (mx-auto max-w-[1280px] px-4 py-6 sm:px-6)
```

Nav items are defined in `navItems`
(`src/routes/(app)/$projectSlug/route.tsx` — 5 items: dashboard/documents/monitor/signals/tasks, no insights/updates/wiki by design) and `settingsNavItems`
(`src/routes/(app)/settings/route.tsx` — backed: account/analytics/evals/projects/machines/agents/model-providers/version-source; dead/planned with no backing files: skills/mcp/commands/subagents/web-search/browsers/computer-control), and passed to `<AppShell items={…}>`
(`isSettings` for the settings shell). Scoped items are `/$projectSlug/…` and
receive `params.projectSlug` from the current scope (or `"~"` for Multi-Project)
via `currentScope`. `monitor` is a backed route but renders a placeholder
("Monitor view coming soon"); `analytics`/`evals` settings pages are backed
routes rendering explicit placeholders. `connections` has full backend
(oRPC `connections.*` + `/api/connections.*` OAuth callbacks) but no settings
UI page — tokens/scopes/metadata are not editable from the UI in v1.

Files: `src/components/layout/AppShell.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/UnderlineNav.tsx`, `src/routes/(app)/$projectSlug/route.tsx`, `src/routes/(app)/settings/route.tsx`, `src/routes/__root.tsx` (`<body className="dark">` forces dark — see Deviations; meta is `color-scheme: light dark`).
`src/routeTree.gen.ts` is generated (`bun run gen:routes`); do not hand-edit.

## Tokens (`src/styles.css`)

| Token | Light | Dark | Alias |
|---|---|---|---|
| `--background` | `#ffffff` | `#0d1117` | canvas default |
| `--foreground` | `#1f2328` | `#e6edf3` | fg default |
| `--card` | `#ffffff` | `#161b22` | Box bg |
| `--muted` | `#f6f8fa` | `#21262d` | Box header / subnav |
| `--muted-foreground` | `#656d76` | `#7d8590` | secondary text |
| `--border` / `--input` | `#d0d7de` | `#30363d` | border default |
| `--ring` | `#0969da` | `#1f6feb` | focus |
| `--primary` | `#1f883d` | `#238636` | btn primary (green) |
| `--primary-foreground` | `#ffffff` | `#ffffff` | |
| `--secondary` | `#f6f8fa` | `#21262d` | btn default gray |
| `--secondary-foreground` | `#24292f` | `#e6edf3` | |
| `--destructive` | `#cf222e` | `#da3633` | danger |
| `--radius` | `0.375rem` (6px) | same | sm 4px, md 6px |
| `--sidebar` | `#f6f8fa` | `#010409` | sidebar canvas |
| `--sidebar-foreground` | `#1f2328` | `#e6edf3` | |
| `--sidebar-primary` | `#1f883d` | `#238636` | P mark |
| `--sidebar-border` | `#d0d7de` | `#30363d` | |
| `--chart-1..5` | blue/green/purple/amber/red | darker set | charts |
| Semantic | `--color-accent-fg #0969da` | `#58a6ff` | link / accent |
| | `--color-success-fg #1a7f37` | `#3fb950` | open / success |
| | `--color-danger-fg #cf222e` | `#f85149` | closed / danger |
| | `--color-attention-fg #9a6700` | `#d29922` | warning |
| | `--color-done-fg #8250df` | `#bc8cff` | closed purple |
| | `--color-open-fg #1a7f37` | `#3fb950` | |
| | `--color-closed-fg #656d76` | `#7d8590` | closed **gray** (not purple) |
| Header | `--header-bg #24292f` | `#010409` | vestigial (mobile dark header removed) |

## Fonts

- **Sans:** `"Schibsted Grotesk Variable"` first, then the system stack
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", …`) — bundled via
  `@fontsource-variable/schibsted-grotesk`.
- **Mono:** `"JetBrains Mono Variable"` first, then `ui-monospace`, SFMono,
  etc — bundled via `@fontsource-variable/jetbrains-mono`.
- Both are self-hosted variable fonts (`--font-sans` / `--font-mono` wired
  through `@theme inline`). No Google Fonts, no network fetch.

Body `text-[14px] leading-[1.5]`.

## Typography Scale

- **H1 (page title):** `text-2xl font-semibold tracking-tight` (24px)
- **H2 (section):** `text-sm font-semibold` (14px) or `text-base` for Cards
- **Body:** `text-sm` (14px) leading 1.5; **muted:** `text-muted-foreground`
- **Small / meta:** `text-xs` / `text-[11px]` for pills
- **Code:** `font-mono text-xs`

Do: use `font-semibold` for titles; don’t use `font-bold` or Fraunces/Manrope.

## Components

### Button (`src/components/ui/button.tsx`)
- **Variants:** `primary` (green `#1f883d`, creation actions only: *New project/document/signal/task*), `default` (gray `#f6f8fa` border), `outline` (white + border, most actions), `ghost` (text), `destructive` (red), `link` (blue underline), `secondary` (alias to default)
- **Sizes:** `default h-8 px-4 text-[14px]`, `sm h-7 gap-1.5 px-3 text-xs`, `icon size-8`, `icon-sm size-7` (+ undocumented `lg`, `icon-lg size-9` in `button-variants.ts`)
- **Rules:** green only for *New …*; bulk actions use `outline` gray.

```tsx
<Button variant="primary">New project</Button>
<Button variant="outline" size="sm">View</Button>
<Button variant="ghost" size="sm">Dismiss</Button>
```

### Badge / Label / StateLabel (`src/components/ui/badge.tsx`, `src/components/badges.ts`)
- **Label** (free-form tags): `variant="outline"` pill `rounded-full px-2.5 py-0.5 text-xs` with subtle border.
- **StateLabel** (issue-like): open green subtle `#dafbe1 / #1a7f37`, closed purple `#fbefff / #8250df` via `stateBadgeClass()`; warning amber, danger red, done purple, info muted, success green.
- **Helpers:** `stateBadgeClass(state)`, `severityBadgeClass(severity)`, `taskBadgeClass(status)` in `src/components/badges.ts` return class strings — apply via `className` on `<Badge variant="outline">`.

```tsx
<Badge className={stateBadgeClass(doc.state)} variant="outline">{doc.state}</Badge>
<Badge variant="outline" className="text-[11px] px-1.5 py-0">{label}</Badge>
<Badge variant="success">active</Badge>
```

### Card → Box (`src/components/ui/card.tsx`)
- Flat Box: `rounded-md border bg-card` (no shadow). Header optional `bg-muted/50 border-b px-4 py-3`.
- Structure: `Card` overflow-hidden → `CardHeader bg-muted/50 border-b` (title `text-sm font-semibold`) → `CardContent py-3` → optional border-t footer.
- List usage: single `Card overflow-hidden p-0` with muted header row (`flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs`) then `border-b px-4 py-3` rows (`last:border-0`).

### Table (`src/components/ui/table.tsx`)
- Inside Box: `TableHeader bg-muted/50` + `TableHead h-8 px-3 text-xs font-semibold text-muted-foreground` + `TableRow border-b hover:bg-muted/50` + `TableCell px-3 py-2 text-sm`.
- Always wrapped with Box header showing counts (`{n} documents · filter`).

### Inputs (`input.tsx`, `select.tsx`, `textarea.tsx`, `label.tsx`)
- `h-8 rounded-md border border-input bg-background px-3 py-1 text-sm focus:border-ring focus:ring-ring/30 focus:ring-[3px]`
- Label `text-xs font-semibold`, help `text-xs text-muted-foreground`.

### Dialog (`dialog.tsx`)
- Overlay `bg-[#24292f]/50`; container `max-w-lg px-4`; content `rounded-md border bg-card`; header `border-b bg-muted/50 px-4 py-3 rounded-t-md` (title `text-sm font-semibold`, description `text-xs muted`).

### Alert (`alert.tsx`)
- `rounded-md border px-4 py-3 text-sm grid`; `destructive` is light red `#ffebe9` / dark `#260f12` with red text/border.

## Icons

Hugeicons free stroke-rounded as committed (`@hugeicons/react` + `@hugeicons/core-free-icons`, adapted to component API in `src/components/icons.tsx`) despite `components.json: iconLibrary tabler`. Size `size-4.25` in nav/buttons, `size-4` in meta. Workspace nav uses `LayoutDashboard/BookOpen/Radar/Radio/SquareKanban` (no `FolderKanban/RadioTower/Bot` Octicon mapping).

## Deviations (code wins — fix code or accept)

- Forced dark: `src/routes/__root.tsx:37` renders `<body className="dark">`, overriding the `light dark` meta. Guide norm is no forced dark.
- Sidebar: no brand P-mark, no chat actions, and no avatar/user footer.
- Shadows: `dialog.tsx:38 shadow-sm`, `documents/Editor.tsx:323 shadow-md`, `ui/toaster.tsx:40 shadow-lg + rounded-lg` violate the no-shadow / `rounded-md` rule.
- Badge: `DocumentHeader.tsx:76` uses `<Badge variant="secondary">`, not the guide's `variant="outline"` + `className` helper pattern.

## Do / Don’t

- **Do** use `variant="primary"` only for *New …* creators.
- **Do** put filters in `CardContent bg-muted/50`.
- **Do** use `UnderlineNav` (`border-b-2 border-[#fd8c73]`) for kind/state tabs.
- **Don’t** use `shadow-sm`, `rounded-xl`, `bg-primary` black, zinc tokens (zinc ban holds — no `zinc-` hits), or add new forced-`dark` (existing forced dark above is the one exception to remove, not copy).
- **Don’t** create per-page `severityBadgeClass` clones — use `badges.ts`.
- **Don’t** add a second sidebar or a second top nav: `AppShell` renders exactly one shell per viewport — `AppSidebar` (desktop) and the mobile selector bar + `UnderlineNav` (mobile) are the only shells, swapped at `md:`, never shown together.

## Checklist (new page)

1. Page header: `h1 text-2xl font-semibold` + `p text-sm text-muted-foreground` + `Button variant="primary"` if creation.
2. Tabs (if any): nav `border-b` with active `border-[#fd8c73] font-semibold`.
3. Filters: `Card > CardContent bg-muted/50 flex gap-3` with `Label text-xs font-semibold`.
4. Content: `Card overflow-hidden p-0` with header `border-b bg-muted/50 px-4 py-2 text-xs` counts + body table/list rows `border-b px-4 py-3 hover:bg-muted/50`.
5. Empty: `Card py-10 text-center` with `variant="primary"` CTA; Error: `Alert variant="destructive"` + `Button variant="outline" size="sm" Retry`.

## References

- Primer: https://primer.style / foundations/color
- Shell: `src/components/layout/AppShell.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/UnderlineNav.tsx`, `src/routes/(app)/$projectSlug/route.tsx` + `(app)/settings/route.tsx` (nav item arrays), `src/routes/__root.tsx`
- Tokens & fonts: `src/styles.css`
- Primitives: `src/components/ui/*`
