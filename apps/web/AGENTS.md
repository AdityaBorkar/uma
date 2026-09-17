# AGENTS.md — apps/web (Planner Q3)

Product app: TanStack Start (React 19, file-based routes), oRPC API, Drizzle/PostgreSQL, better-auth. Before changing product behavior or UI, read `docs/CONTEXT.md` (domain vocabulary + "avoid" terms) and `docs/STYLE_GUIDE.md`; check `docs/adr/` for prior decisions.

## Commands (run in `apps/web`)

- `bun run dev` — dev server (via `run:dev`, sources env from Pulumi `dev` stack; needs `pulumi` CLI + `PULUMI_CONFIG_PASSPHRASE` non-interactive).
- `bun run:dev -- <cmd>` — run any command with `dev`-stack env (e.g. `bun run:dev -- drizzle-kit push`).
- `bun run db:push` / `bun run db:studio` — push schema / open Drizzle Studio (both via `run:dev`).
- `bun run gen:routes` — regenerate `src/routeTree.gen.ts` (never hand-edit).
- `bun run gen:auth-schema` — regenerate `src/schemas/db/auth.gen.ts` (via `run:dev`; never hand-edit).
- `bun run build` — `vite build`. `bun run preview` — `vite preview`.
- Typecheck: `bunx tsc --noEmit` (in this dir; root `check:types` fails on Astro virtual modules).
- Lint/format: from repo root, `bun run check:lint` / `bun run format` (Biome only).
- No unit tests here — verify with `tsc --noEmit` + `vite build`; end-to-end via `bun run roundtrip` in `apps/machine` against this dev server.

## Conventions

- Imports use `#/*` → `src/*` alias with explicit `.ts`/`.tsx` extensions; `import type` for types (`verbatimModuleSyntax`).
- Routes are file-based under `src/routes/` (`$projectSlug` scoping, `__root.tsx` forces dark-only `<body className="dark">`). Route tree is generated.
- API: new surface is contract-first — `implementer` from `#/rpc/contract.ts` (backed by `@uma/orpc-contract`); older namespaces are plain `os` procedures migrating incrementally. Procedures live in `src/rpc/procedures/`, shared guards in `src/rpc/auth.ts` (`requireUser`) and `src/rpc/scope.ts` (`assertProjectOwned`, cursor pagination helpers).
- Errors: `throw new ORPCError("<CODE>", { message })` (`NOT_FOUND`/`BAD_REQUEST`/`FORBIDDEN`/`INTERNAL_SERVER_ERROR`); contract-first handlers use `throw errors.NOT_FOUND()`.
- DB: Drizzle schemas in `src/schemas/db/` (snake_case columns ↔ camelCase fields, pgEnums, `CHECK`s for invariants like terminal-status timestamps); Zod input schemas in `src/schemas/schema.ts`. Every query filters by `userId`; child rows checked via parent ownership. Server stamps all lifecycle timestamps — never accept client timestamps. DB `CHECK`s are the backstop, not the client.
- Env: validated in `src/env.ts` (`@t3-oss/env-core`); `PUBLIC_*` are build-time (need Dockerfile `ARG`), secrets runtime-only. New vars must also be added to `apps/infra/utils/extract-env.ts` manifest.
- Domain language: documents use `state` (`open|closed`), tasks/connections use `status`; `number` = per-user sequential doc id, `slug` = URL segment. Follow the "avoid" lists in `CONTEXT.md`.
- UI: `STYLE_GUIDE.md` is law — dark-only, registered tokens only (no `[...]` arbitrary values, no `dark:` variants, no blue/purple accents), `primary` buttons only for *New …* actions, `stateBadgeClass`/`taskBadgeClass` helpers, filters in muted `CardContent`, motion via `motion` library tokens.
- Strict TS applies (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`) — handle `undefined`, narrow `catch (e)`.
