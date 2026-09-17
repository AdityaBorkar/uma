# ---- build stage ----
FROM oven/bun:1.4 AS build
WORKDIR /app

# NOTE: build context is the repo root (see apps/infra/docker/server.ts).
# Root manifest first for a cache-friendly install layer. The server is part
# of the bun workspaces monorepo, so every workspace package.json must be
# present before install (workspace:* deps like @uma/orpc-contract resolve
# from the local tree, not the registry).
COPY package.json bun.lockb bunfig.toml ./
COPY apps/cli/package.json apps/cli/
COPY apps/documentation/package.json apps/documentation/
COPY apps/infra/package.json apps/infra/
COPY apps/machine/package.json apps/machine/
COPY apps/orpc-contract/package.json apps/orpc-contract/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# Copy the rest of the source tree (.dockerignore keeps secrets/caches out).
COPY . .

# Server has no build-time vars: all config is runtime env (see
# apps/infra/utils/extract-env.ts). No ARG block by design.

# ---- runtime stage ----
FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app

COPY --from=build /app/package.json /app/bun.lockb /app/bunfig.toml /app/
COPY --from=build /app/apps/orpc-contract /app/apps/orpc-contract
COPY --from=build /app/apps/server /app/apps/server

WORKDIR /app/apps/server
# Install production deps only for the server workspace tree.
RUN bun install --frozen-lockfile --production

USER bun
ENV HOST=0.0.0.0
CMD ["bun", "src/index.ts"]
