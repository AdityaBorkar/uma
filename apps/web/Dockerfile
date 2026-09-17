# ---- build stage ----
FROM oven/bun:1.4 AS build
WORKDIR /app

# NOTE: build context is the repo root (see apps/infra/docker/app.ts).
# Root manifest first for a cache-friendly install layer. The web app is part
# of the bun workspaces monorepo, so every workspace package.json must be
# present before install (workspace:* deps like @uma/orpc-contract resolve
# from the local tree, not the registry).
COPY package.json bun.lockb bunfig.toml ./
COPY apps/cli/package.json apps/cli/
COPY apps/documentation/package.json apps/documentation/
COPY apps/infra/package.json apps/infra/
COPY apps/machine/package.json apps/machine/
COPY apps/orpc-contract/package.json apps/orpc-contract/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# Copy the rest of the source tree (.dockerignore keeps secrets/caches out).
COPY . .

# Build args for build-time vars. Keep in sync with
# apps/infra/utils/extract-env.ts (single source of truth);
# `bun run check:env` in apps/web verifies this block.
ARG PUBLIC_WEB_DOMAIN
ARG PUBLIC_WEB_PORT
ARG PUBLIC_WEB_SSL
ARG PUBLIC_SERVER_URL
ARG PUBLIC_POSTHOG_KEY
ARG PUBLIC_POSTHOG_HOST
ENV PUBLIC_WEB_DOMAIN=$PUBLIC_WEB_DOMAIN \
    PUBLIC_WEB_PORT=$PUBLIC_WEB_PORT \
    PUBLIC_WEB_SSL=$PUBLIC_WEB_SSL \
    PUBLIC_SERVER_URL=$PUBLIC_SERVER_URL \
    PUBLIC_POSTHOG_KEY=$PUBLIC_POSTHOG_KEY \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST
# The runtime stage runs under Bun, so build the Bun Nitro preset (required
# for the /api/machines/ws websocket handler — the default node preset's
# crossws adapter refuses to start under Bun).
ENV NITRO_PRESET=bun

# Build the web workspace from its own directory (context is the repo root).
# The UI talks to the control plane (`apps/server`) over HTTP: browsers use
# PUBLIC_SERVER_URL (empty = same origin, Caddy routes `/api/*` to the
# server), SSR uses runtime-only CONTROL_PLANE_URL (derived in
# apps/infra/docker/web.ts, never a build arg).
WORKDIR /app/apps/web
RUN bun run build

# ---- runtime stage ----
FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app

COPY --from=build /app/apps/web/.output ./.output

USER bun
CMD ["bun", ".output/server/index.mjs"]
