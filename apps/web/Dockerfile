# ---- build stage ----
FROM oven/bun:1.4 AS build
WORKDIR /app

COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy the rest of the source tree (.dockerignore keeps secrets/caches out).
COPY . .

# Build args for build-time vars. Keep in sync with infra/utils/extract-env.ts
# (single source of truth); scripts/check-env.ts verifies this block.
ARG PUBLIC_WEB_DOMAIN
ARG PUBLIC_WEB_PORT
ARG PUBLIC_WEB_SSL
ARG PUBLIC_POSTHOG_KEY
ARG PUBLIC_POSTHOG_HOST
ENV PUBLIC_WEB_DOMAIN=$PUBLIC_WEB_DOMAIN \
    PUBLIC_WEB_PORT=$PUBLIC_WEB_PORT \
    PUBLIC_WEB_SSL=$PUBLIC_WEB_SSL \
    PUBLIC_POSTHOG_KEY=$PUBLIC_POSTHOG_KEY \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST

RUN bun vite build

# ---- runtime stage ----
FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app

COPY --from=build /app/.output ./.output

USER bun
CMD ["bun", ".output/server/index.mjs"]
