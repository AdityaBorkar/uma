# AGENTS.md — apps/infra

Pulumi program (OCI VM + Cloudflare DNS + Docker + pgBackRest) plus the app env manifest. `Pulumi.yaml` at the repo root points at `apps/infra/index.ts`. Stack `dev` uses local Docker; all other stacks provision an OCI VM.

## Commands

- At repo root: `bun run infra:up|infra:preview|infra:refresh|infra:destroy --stack <name>` (thin `pulumi` wrappers). Never run non-`dev` stacks without explicit user approval.
- `apps/web` dev/DB commands go through `utils/run-command.ts` (`bun run:dev -- …` in `apps/web`), which parses `pulumi config --json --show-secrets` for the `dev` stack — needs `pulumi` CLI + `PULUMI_CONFIG_PASSPHRASE` when non-interactive.
- Typecheck: `cd apps/infra && bunx tsc --noEmit`. Lint/format from root: `bun run check:lint` / `bun run format`.
- No tests in this app. Verify with `tsc --noEmit` and `infra:preview --stack dev`.

## Conventions

- Imports use relative paths with explicit `.ts` extensions, `import type` for types (`verbatimModuleSyntax`, strict TS). There is no `#/*` alias in this app.
- `utils/extract-env.ts` is the single source of truth for app env (`APP_ENV_VARS` manifest + `appEnvValues`/`appBuildArgs`/`appRuntimeEnvs`/`extractEnv`). When adding a var: add it here (correct `source`: `app`|`postgres`|`derived`; `secret` for secrets; `optional` for unset-tolerant; `build: true` only for `PUBLIC_*`), then update `apps/web/src/env.ts` validation and `apps/web/Dockerfile` (`ARG` only for `PUBLIC_*`; secrets runtime-only, never build args — `appBuildArgs` excludes them by construction).
- Config keys are namespaced (`namespace:NAME`); `extractEnv` strips the prefix and returns a name-sorted flat map. Secrets go through `requireSecret`, optionals through `get` (empty string when unset).
- DB backup wiring is currently commented out in `index.ts`; runbook in `docs/do-not-touch-ai/BACKUPS.md`, decision in `apps/web/docs/adr/007-postgresql-backups.md`. `README-dev.md` tracks ops gaps (silent backup failures, unplumbed `backup:CIPHER_PASS`, no restore tooling) — read it before touching backup code.
- Wiring is verified, not trusted: `docker/app.ts` builds from the repo-root context with `apps/web/Dockerfile`; `utils/run-command.ts` resolves the repo root where `Pulumi.yaml` lives; `bun run check:env` in `apps/web` verifies the env manifest against the Dockerfile and `apps/web/src/env.ts`. Fix paths when you touch them; don't entrench them.
- Never commit `.env` files or real secrets; values come from Pulumi stack config.
