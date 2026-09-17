# AGENTS.md — apps/web (Planner Q3 UI)

Product UI: TanStack Start (React 19, file-based routes). No server code, no
DB access — every data call goes over HTTP to the control plane
(`apps/server`): oRPC via `#/lib/rpc.ts` (`origin` = `PUBLIC_SERVER_URL`,
empty = same origin), plain `fetch(apiUrl("/api/…"))` for the utility
endpoints. Before changing product behavior or UI, read `docs/CONTEXT.md`
(domain vocabulary + "avoid" terms) and `docs/STYLE_GUIDE.md`; check
`docs/adr/` for prior decisions.

## Commands (run in `apps/web`)

- `bun run dev` — UI dev server on `:3000` (via `run:dev`, sources env from
  Pulumi `dev` stack; needs `pulumi` CLI + `PULUMI_CONFIG_PASSPHRASE`
  non-interactive). `/api/*` (incl. WS) proxies to the control plane
  (`CONTROL_PLANE_URL`, default `http://127.0.0.1:4000` — run
  `bun run dev` in `apps/server` alongside).
- `bun run:dev -- <cmd>` — run any command with `dev`-stack env.
- `bun run gen:routes` — regenerate `src/routeTree.gen.ts` (never hand-edit).
- `bun run build` — `vite build`. `bun run preview` — `vite preview`.
- `bun run check:env` — verify the `APP_ENV_VARS` manifest against the
  Dockerfile `ARG` block, `src/env.ts`, and the (arg-free) server Dockerfile.
- Typecheck: `bunx tsc --noEmit` (in this dir; root `check:types` fails on Astro virtual modules).
- Lint/format: from repo root, `bun run check:lint` / `bun run format` (Biome only).
- No unit tests here — verify with `tsc --noEmit` + `vite build`; end-to-end via `bun run roundtrip` in `apps/machine` (hits the UI origin, proxied to the control plane).
- DB commands (`db:push`, `db:studio`, `gen:auth-schema`) live in `apps/server` now.

## Conventions

- Imports use `#/*` → `src/*` alias with explicit `.ts`/`.tsx` extensions; `import type` for types (`verbatimModuleSyntax`).
- Routes are file-based under `src/routes/` (`$projectSlug` scoping, `__root.tsx` forces dark-only `<body className="dark">`). Route tree is generated. There are no `src/routes/api/*` routes — `/api/*` is served by the control plane (Caddy in prod, vite proxy in dev).
- API: oRPC procedures live in `apps/server` (`src/rpc/procedures/`); the UI consumes them through `rpc.*.queryOptions()` / `*.mutationOptions()` (`#/lib/rpc.ts`, typed via `@uma/server`). Never import server modules (`apps/server/src/*` at runtime — `import type` only) and never touch the DB from here.
- Session gate: `src/rpc/session.ts` (`getServerSession`, reads the session from the control plane by forwarding cookies). Document detail: `src/components/documents.fns.ts` (`loadDocument` fetches doc + events over oRPC, renders MDX locally via `src/components/mdx.server.ts`).
- Env: validated in `src/env.ts` (`@t3-oss/env-core`). `PUBLIC_*` are build-time (need Dockerfile `ARG`); `CONTROL_PLANE_URL` is runtime-only (SSR origin for the control plane). New vars must also be added to `apps/infra/utils/extract-env.ts` manifest.
- Domain language: documents use `state` (`open|closed`), tasks/connections use `status`; `number` = per-user sequential doc id, `slug` = URL segment. Follow the "avoid" lists in `CONTEXT.md`.
- UI: `STYLE_GUIDE.md` is law — dark-only, registered tokens only (no `[...]` arbitrary values, no `dark:` variants, no blue/purple accents), `primary` buttons only for *New …* actions, `stateBadgeClass`/`taskBadgeClass` helpers, filters in muted `CardContent`, motion via `motion` library tokens.
- Strict TS applies (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`) — handle `undefined`, narrow `catch (e)`.
