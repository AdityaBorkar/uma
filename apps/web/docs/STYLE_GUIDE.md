# Style Guide — Vercel-like Dark Theme (Black/White)

Planner Q3 is dark-only, mirroring Vercel's Geist aesthetic: **true-black canvas, white primary actions, gray borders, border over shadow; bundled variable fonts; UnderlineNav; Box; Label/StateLabel; Blankslate; Timeline**. This is the single source of truth for layout, tokens, and component usage.

## Principles

- **Content first** — filters and tables live in bordered Boxes, not floating Cards with shadows.
- **Border over shadow** — `rounded-md border` (`--radius 6px`) + `border: #262626` on a `#000000` canvas. No `shadow-sm/xl`.
- **Black/white base** — background `#000000`, foreground `#ededed`, muted text `#a1a1a1`, borders `#262626` / `#1f1f1f`. Color is reserved for status indication only (success green, danger red, attention amber); everything else is monochrome.
- **Dark-only** — `:root` and `.dark` carry the same tokens, `color-scheme: dark`, `<body className="dark">`. Never add light-mode branches (`dark:` variants, `light` color-scheme).
- **Bundled variable fonts** — Schibsted Grotesk Variable for sans, JetBrains Mono Variable for code, both via `@fontsource-variable/*` (self-hosted, no Google Fonts / no network).
- **Text + color** — never color alone. Badges/StateLabels include text and pass contrast.
- **One shell** — the `AppShell` component (`src/components/layout/AppShell.tsx`) renders exactly one shell per viewport, swapped at `md:`, never both. Desktop (`md+`): `AppSidebar` (project selector, nav — no brand mark, chat actions, or user footer as committed) beside centered content (`max-w-320` = 80rem content width, `px-4 sm:px-6`). Mobile: project selector bar → sticky `UnderlineNav` → content (no dark header; the sidebar is hidden).

## Layout (App Shell)

The shell is `AppShell` (`src/components/layout/AppShell.tsx`): it derives the
current scope (matched `$projectSlug` param, else pathname + `planner:lastScope`
hint), renders `AppSidebar` on `md+` and a mobile selector bar + `UnderlineNav`
below `md`, and hosts the "Create project" dialog. There is no global footer.

Desktop (`md+`) — `AppSidebar` (sticky, fixed 280px) + content column:

```
AppSidebar (sticky top-0 h-screen w-70 = 17.5rem sidebar, border-r, hidden below md)
  project selector: beUI Select (`src/components/motion/select.tsx`, gooey unfold) — Settings · Global Workspace (~) · per-project slugs
  nav: items prop (navItems / settingsNavItems)
  (no brand P-mark block, no chat actions, no avatar/user footer as committed)
Main (mx-auto max-w-320 px-4 py-6 sm:px-6)
  Page header → Filters Box → Content Box → (optional) Timeline aside
```

Mobile (below `md`) — selectors + `UnderlineNav`, rendered by `AppShell`:

```
Project selector bar (border-b bg-muted/50 px-4 py-2, native select)
  Multi-Project · per-project slugs · Create Project
UnderlineNav (sticky top-14 z-30, bg-background, border-b, scroll-x, hides scrollbar)
  tabs: current nav items (items prop)
  active: text-foreground font-semibold + a shared motion underline bar that
  glides between tabs on the tabs spring (see Motion)
Main (mx-auto max-w-320 px-4 py-6 sm:px-6)
```

Nav items are defined in `navItems`
(`src/routes/(app)/$projectSlug/route.tsx:27-33` — 5 items: dashboard/documents/releases/monitor/tasks; `automations.tsx:7-29` is a placeholder orphan not in nav) and `settingsNavItems`
(`src/routes/(app)/settings/route.tsx:26-57` — backed: account/analytics/evals/projects/machines/agents/skills/mcp-servers/prompt-templates/subagents/model-providers/version-source; no backing files: web-search/browsers/computer-control; `commands.tsx:3-8` redirects), and passed to `<AppShell items={…}>`
(`isSettings` for the settings shell). Scoped items are `/$projectSlug/…` and
receive `params.projectSlug` from the current scope (or `"~"` for Multi-Project)
via `currentScope`. `monitor` is a backed route but renders a placeholder
("Monitor view coming soon"); `analytics`/`evals` settings pages are backed
routes rendering explicit placeholders. `connections` has full backend
(oRPC `connections.*` + `/api/connections.*` OAuth callbacks) but no settings
UI page — tokens/scopes/metadata are not editable from the UI in v1.

Files: `src/components/layout/AppShell.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/UnderlineNav.tsx`, `src/routes/(app)/$projectSlug/route.tsx`, `src/routes/(app)/settings/route.tsx`, `src/routes/__root.tsx` (`<body className="dark">` forces dark-only — intentional; meta is `color-scheme: dark`).
`src/routeTree.gen.ts` is generated (`bun run gen:routes`); do not hand-edit.

## Tokens (`src/styles.css`)

Dark-only, Vercel-like. `:root` and `.dark` are identical.

| Token | Dark-only | Notes |
|---|---|---|
| `--background` | `#000000` | canvas default |
| `--foreground` | `#ededed` | fg default |
| `--card` / `--popover` | `#0a0a0a` | Box bg |
| `--muted` | `#111111` | Box header / subnav |
| `--muted-foreground` | `#a1a1a1` | secondary text |
| `--border` / `--input` | `#262626` | border default |
| `--ring` | `#737373` | focus (neutral gray, not blue) |
| `--primary` | `#ededed` | btn primary (white bg, black text) |
| `--primary-foreground` | `#000000` | |
| `--secondary` / `--accent` | `#1a1a1a` | btn default gray |
| `--secondary-foreground` | `#ededed` | |
| `--destructive` | `#e5484d` | danger (status-only color) |
| `--radius` | `0.375rem` (6px) | sm 4px, md 6px |
| `--sidebar` | `#000000` | sidebar canvas |
| `--sidebar-foreground` | `#ededed` | |
| `--sidebar-primary` | `#ededed` | white primary |
| `--sidebar-border` | `#1f1f1f` | |
| `--chart-1..5` | `#ededed / #a1a1a1 / #737373 / #525252 / #404040` | grayscale ramp |
| Semantic | `--color-accent-fg #ededed` | link / accent (neutral, not blue) |
| | `--color-success-fg #46a758` | open / success |
| | `--color-danger-fg #e5484d` | closed-failed / danger |
| | `--color-attention-fg #f5a524` | warning |
| | `--color-done-fg #a1a1a1` | neutral gray (no purple) |
| | `--color-open-fg #46a758` | |
| | `--color-closed-fg #a1a1a1` | closed **gray** |
| Subtle bg | `--color-success-bg #0e1f14` | badge/alert green wash |
| | `--color-attention-bg #201503` | badge amber wash |
| | `--color-danger-bg #251314` | badge/alert red wash |
| | `--color-done-bg #1a1a1a` | neutral wash (no purple) |
| | `--color-info-bg #1a1a1a` | neutral wash (no blue — running states are gray) |
| Edge | `--color-success-border #2e5a3e` | success border |
| | `--color-danger-edge #e5484d` | alert destructive border |
| | `--color-overlay #000000` | dialog scrim (`bg-overlay/50`) |
| | `--color-underline #ededed` | active underline (`border-underline`, white) |
| Type | `--text-micro 0.6875rem` | same | 11px pills/meta (`text-micro`) |
| | `--text-compact 0.8125rem` | same | 13px menu titles (`text-compact`) |
| Blur | `--blur-subtle 1px` | same | dialog scrim (`backdrop-blur-subtle`) |
| Header | `--header-bg #24292f` | `#010409` | vestigial (mobile dark header removed) |

> **Rule: no arbitrary values.** Never use `[...]` design values in class
> strings — no `bg-[#...]`, `text-[#...]`, `border-[#...]`,
> `text-[var(--...)]`, `text-[11px]`, `max-w-[...]`, `ring-[3px]`, or
> palette shortcuts (`bg-red-50`, `text-amber-800`). Register the token in
> `src/styles.css` (`:root` + `.dark` + `@theme inline`) and use it
> (`bg-danger-bg`, `text-accent-fg`, `border-underline`, `text-micro`,
> `max-w-320`, `ring-3`). Viewport/runtime shapes with no spacing-token
> equivalent (`70dvh` dialogs, `minmax(0,1fr)` grids, Base UI anchor vars,
> hidden scrollbars) live as plain classes in `styles.css`
> (`.dialog-body`, `.doc-split`, `.select-popup`, `.scrollbar-none`).
> Functional state variants (`data-[popup-open]:`, `has-[>svg]:`,
> `[&>svg]:`) carry token values only — they are selectors, not definitions.
> Exceptions (documented at use): third-party brand fills (Google G logo
> `fill="#4285F4"…`) and user-data-driven color (`subagents` dot
> `style={{ backgroundColor }}` — validated `#RRGGBB`, always paired with
> text).

## Fonts

- **Sans:** `"Schibsted Grotesk Variable"` first, then the system stack
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", …`) — bundled via
  `@fontsource-variable/schibsted-grotesk`.
- **Mono:** `"JetBrains Mono Variable"` first, then `ui-monospace`, SFMono,
  etc — bundled via `@fontsource-variable/jetbrains-mono`.
- Both are self-hosted variable fonts (`--font-sans` / `--font-mono` wired
  through `@theme inline`). No Google Fonts, no network fetch.

Body `text-sm` (14px) `leading-[1.5]`.

## Typography Scale

- **H1 (page title):** `text-2xl font-semibold tracking-tight` (24px)
- **H2 (section):** `text-sm font-semibold` (14px) or `text-base` for Cards
- **Body:** `text-sm` (14px) leading 1.5; **muted:** `text-muted-foreground`
- **Small / meta:** `text-xs` / `text-micro` (11px token) for pills
- **Code:** `font-mono text-xs`

Do: use `font-semibold` for titles; don’t use `font-bold` or Fraunces/Manrope.

## Motion (beUI language)

All interface motion follows beUI (`beui.dev/docs/motion-patterns`) and is built
with the `motion` library (`motion/react`) — never hand-rolled CSS keyframes for
state feedback (`.rise-in` is the one CSS exception, kept on the same tokens).
Vended beUI sources live in `src/components/motion/`; the product primitives in
`src/components/ui/` + `src/components/layout/` speak the same language with
this theme's tokens.

### Decision framework

1. **Check frequency.** Repeated actions feel nearly instant (hover washes stay
   CSS `transition-colors`). Expressive motion is for rare moments (dialog open,
   active-nav change, toast spawn).
2. **Name the purpose.** Motion explains space (dialog unfold, active glide),
   confirms input (press dip, error shake), shows state (badge roll, toast
   morph), or softens a change (row stagger, card height morph).
3. **Choose the physics.** Ease-out for entrances, springs for gestures and
   shared surfaces. Never linear except progress/spinners.
4. **Design the fallback.** Reduced motion keeps opacity/color feedback and
   drops travel, scale, blur, and overshoot — every motion primitive reads
   `useReducedMotion()`.

### Tokens (`src/lib/ease.ts`)

| Token | Use |
|---|---|
| `EASE_OUT [0.16, 1, 0.3, 1]` | entrances/exits (also `EASE_OUT_CSS` for CSS) |
| `SPRING_PRESS` | press dips (`whileTap scale 0.97`) |
| `SPRING_LAYOUT` | shared surfaces gliding (sidebar active, card height) |
| `SPRING_PANEL` | overlay panels unfolding (dialog) |
| `SPRING_SWAP` | content trading places (badge roll, button slots) |
| `SPRING_MOUSE` | decorative cursor-follow only (magnetic, tilt) |
| Tabs underline spring (`motion/tabs.tsx`, `UnderlineNav`) | glides that must settle without overshoot inside scroll rails |

### Timing (under 300ms default)

| Interaction | Range |
|---|---|
| Press dip | spring, feels 100–160ms |
| Tooltip/popover | 125–200ms |
| Dropdown/select unfold | 150–250ms |
| Modal/dialog | 200–500ms (panel spring + 200ms scrim fade) |
| Row stagger | 180ms each, 15ms cascade capped at 150ms |

### Mapping (beUI → local)

| beUI | Local | Notes |
|---|---|---|
| Button press | `ui/button.tsx` | `whileTap 0.97` + `SPRING_PRESS`; hover stays CSS |
| Animated Sidebar active | `layout/AppSidebar.tsx` | one `layoutId` surface glides (`SPRING_LAYOUT`); hover stays an instant CSS wash; popup unfolds with blur rise; items stagger in |
| Tabs underline | `layout/UnderlineNav.tsx`, `motion/tabs.tsx`, `lists/UnderlineTabs.tsx` | shared active underline glides on one layoutId, a muted hover underline glides on a second (shared-layout-bg language), both on the no-overshoot tabs spring inside a `layoutRoot` rail |
| Center Morph Modal | `ui/dialog.tsx` | scrim fade + panel spring (`0.97→1`, `y 20→0`) + `layout` height morph; Esc closes, body scroll locks, `PresenceGate` releases interaction on exit start |
| Animated Toast Stack | `ui/toaster.tsx` | blur-rise spawn, fast blur-slide exit, `layout` spring, swipe-to-dismiss (`|x|>72` or velocity); store API unchanged |
| Animated Badge | `ui/badge.tsx` | shell `layout`-morphs width, content blur-rolls (`contentKey` available for counts) |
| Table (minimal) | `ui/table.tsx` | opacity-only row reveal with capped stagger (transforms don't apply to `tr`); `TableBody` injects `staggerIndex`, overridable per row |
| Input shake | `ui/input.tsx`, `ui/textarea.tsx` | single shake on the transition into `aria-invalid`, never per render |
| Alert reveal | `ui/alert.tsx` | fast lift + `layout` |
| Card continuity | `ui/card.tsx` | `layout` height morph, no mount animation |
| Tooltip / Tabs / Toast primitives | `motion/tooltip.tsx`, `motion/tabs.tsx`, `motion/*` | vended beUI sources; use directly for new floating/tab UI |

### Rules

- **Do** gate decorative hover motion behind hover capability + reduced motion
  (`useHoverCapable()` in `src/lib/hooks/`); functional feedback needs only the
  reduced-motion gate.
- **Do** keep `layoutRoot` around any shared-`layoutId` indicator inside a
  scrolled container (sidebar nav, tab rails).
- **Don’t** animate `tr` transforms, add mount animations to `Card`, or exceed
  300ms on product surfaces.
- **Don’t** install beUI as a package — copy the language into our primitives
  (per beUI's own "own the code" model), keeping these dark-only tokens.

## Components

### Button (`src/components/ui/button.tsx`)
- **Variants:** `primary` (white `#ededed` bg + black text, creation actions only: *New project/document/task*), `default` (gray `#1a1a1a` border), `outline` (black + border, most actions), `ghost` (text), `destructive` (red — errors only), `link` (foreground underline, not blue), `secondary` (alias to default)
- **Sizes:** `default h-8 px-4 text-sm`, `sm h-7 gap-1.5 px-3 text-xs`, `icon size-8`, `icon-sm size-7` (+ undocumented `lg`, `icon-lg size-9` in `button-variants.ts`)
- **Motion:** beUI press dip — `whileTap scale 0.97` on `SPRING_PRESS` (instant for repeated taps); hover stays CSS color. `asChild` renders statically.
- **Rules:** green only for *New …*; bulk actions use `outline` gray.

```tsx
<Button variant="primary">New project</Button>
<Button variant="outline" size="sm">View</Button>
<Button variant="ghost" size="sm">Dismiss</Button>
```

### Badge / Label / StateLabel (`src/components/ui/badge.tsx`, `src/components/badges.ts`)
- **Label** (free-form tags): `variant="outline"` pill `rounded-full px-2.5 py-0.5 text-xs` with subtle border.
- **StateLabel** (issue-like): open green `#0e1f14 / #46a758`, closed neutral gray via `stateBadgeClass()`; warning amber, danger red. `done`/`info` variants are neutral gray — no purple, no blue. Running tasks are gray, not blue.
- **Motion:** beUI animated-badge — shell width-morphs on a spring, content blur-rolls on change (`contentKey` for counts); reduced motion is opacity-only.
- **Helpers:** `stateBadgeClass(state)`, `taskBadgeClass(status)` in `src/components/badges.ts` return class strings — apply via `className` on `<Badge variant="outline">`.

```tsx
<Badge className={stateBadgeClass(doc.state)} variant="outline">{doc.state}</Badge>
<Badge variant="outline" className="text-micro px-1.5 py-0">{label}</Badge>
<Badge variant="success">active</Badge>
```

### Card → Box (`src/components/ui/card.tsx`)
- Flat Box: `rounded-md border bg-card` (no shadow). Header optional `bg-muted/50 border-b px-4 py-3`.
- Structure: `Card` overflow-hidden → `CardHeader bg-muted/50 border-b` (title `text-sm font-semibold`) → `CardContent py-3` → optional border-t footer.
- List usage: single `Card overflow-hidden p-0` with muted header row (`flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs`) then `border-b px-4 py-3` rows (`last:border-0`).

### Table (`src/components/ui/table.tsx`)
- Inside Box: `TableHeader bg-muted/50` + `TableHead h-8 px-3 text-xs font-semibold text-muted-foreground` + `TableRow border-b hover:bg-muted/50` + `TableCell px-3 py-2 text-sm`.
- Always wrapped with Box header showing counts (`{n} documents · filter`).
- **Motion:** beUI table (minimal) — body rows fade in with a capped stagger (`TableBody` injects `staggerIndex`; pass explicitly to override); opacity-only since transforms don't apply to `tr`.

### Inputs (`input.tsx`, `select.tsx`, `textarea.tsx`, `label.tsx`)
- `h-8 rounded-md border border-input bg-background px-3 py-1 text-sm focus:border-ring focus:ring-ring/30 focus:ring-3`
- Label `text-xs font-semibold`, help `text-xs text-muted-foreground`.

### Dialog (`dialog.tsx`)
- Overlay `bg-overlay/50 backdrop-blur-subtle`; container `max-w-lg px-4`; content `rounded-md border bg-card`; header `border-b bg-muted/50 px-4 py-3 rounded-t-md` (title `text-sm font-semibold`, description `text-xs muted`).
- **Motion:** beUI center-morph — scrim fades (200ms), panel unfolds on `SPRING_PANEL` with a `layout` height morph; Esc closes, body scroll locks, exits play via `AnimatePresence`.

### Alert (`alert.tsx`)
- `rounded-md border px-4 py-3 text-sm grid`; `destructive` is dark red wash `#251314` with red text/border.

## Icons

Hugeicons free stroke-rounded as committed (`@hugeicons/react` + `@hugeicons/core-free-icons`, adapted to component API in `src/components/icons.tsx`) despite `components.json: iconLibrary tabler`. Size `size-4.25` in nav/buttons, `size-4` in meta. Workspace nav uses `LayoutDashboard/BookOpen/Rocket/Radar/SquareKanban` (`src/routes/(app)/$projectSlug/route.tsx:5-11`).

## Deviations (code wins — fix code or accept)

- Dark-only is intentional: `src/routes/__root.tsx` renders `<body className="dark">` with `color-scheme: dark` and identical `:root`/`.dark` tokens. Do not add light-mode branches.
- Sidebar: no brand P-mark, no chat actions, and no avatar/user footer.
- Badge: `src/components/documents/DocumentHeader.tsx:4,74-79` uses `DocStateBadge` + `<Badge variant="outline">` — matches the guide. No `variant="secondary"` remains in that file.

## Do / Don’t

- **Do** use `variant="primary"` only for *New …* creators.
- **Do** put filters in `CardContent bg-muted/50`.
- **Do** use `UnderlineNav` (shared motion underline) for kind/state tabs.
- **Don’t** use `shadow-sm`, `rounded-xl`, `bg-primary` black, zinc tokens (zinc ban holds — no `zinc-` hits), blue/purple accents, or add light-mode branches (`dark:` variants, `light` color-scheme).
- **Don’t** create per-page badge-class clones — use `badges.ts`.
- **Don’t** add a second sidebar or a second top nav: `AppShell` renders exactly one shell per viewport — `AppSidebar` (desktop) and the mobile selector bar + `UnderlineNav` (mobile) are the only shells, swapped at `md:`, never shown together.

## Checklist (new page)

1. Page header: `h1 text-2xl font-semibold` + `p text-sm text-muted-foreground` + `Button variant="primary"` if creation.
2. Tabs (if any): rail `border-b` with a shared motion underline gliding to the active tab (`font-semibold`).
3. Filters: `Card > CardContent bg-muted/50 flex gap-3` with `Label text-xs font-semibold`.
4. Content: `Card overflow-hidden p-0` with header `border-b bg-muted/50 px-4 py-2 text-xs` counts + body table/list rows `border-b px-4 py-3 hover:bg-muted/50`.
5. Empty: `Card py-10 text-center` with `variant="primary"` CTA; Error: `Alert variant="destructive"` + `Button variant="outline" size="sm" Retry`.

## References

- Primer: https://primer.style / foundations/color
- Shell: `src/components/layout/AppShell.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/UnderlineNav.tsx`, `src/routes/(app)/$projectSlug/route.tsx` + `(app)/settings/route.tsx` (nav item arrays), `src/routes/__root.tsx`
- Tokens & fonts: `src/styles.css`
- Primitives: `src/components/ui/*`
