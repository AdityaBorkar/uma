# AGENTS.md — apps/documentation

Astro + fumadocs docs site. Deliberately outside the main toolchain: NOT in the root tsconfig `references`, and Biome linting is disabled for it (`biome.json` overrides). Root `bun run check:types` fails on its Astro virtual modules — that is expected, ignore it.

## Commands (run in `apps/documentation`)

- `bun run dev` (alias `start`) — Astro dev server. `bun run build` — production build. `bun run preview` — preview the build. `bun run astro` — raw Astro CLI.
- `bun run lint` (`biome check`) / `bun run format` (`biome format --write`) — local-only; not part of the root check. Keep formatting consistent with the rest of the repo anyway.
- Typecheck locally if needed, but do not gate on root `check:types` for this app.

## Conventions

- Content is Markdown/MDX (fumadocs). Keep docs edits scoped to this site; product theory in `docs/do-not-touch-ai/` is frozen (do not restructure or move it), and `apps/web` / `apps/machine` docs are owned by those apps — link, don't duplicate.
- React 19 + Tailwind v4 (same major versions as `apps/web`), but components here are docs-site-local. Don't import from `apps/web/src` — duplicate the small piece or extract a shared package deliberately.
- Fonts are bundled via `@fontsource-variable/*` (no Google Fonts / network fetch), mirroring the web app's self-hosted font rule.
- Deps are app-local (astro, fumadocs, mermaid, sharp, takumi-js). Shared pins still go through the root catalog where they already exist; don't invent a second toolchain (no ESLint/Prettier — Biome only).
