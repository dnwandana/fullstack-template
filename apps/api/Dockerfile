# syntax=docker/dockerfile:1

# ---- build stage ----
# Full workspace install + Prisma client generation + TypeScript compile.
FROM node:24.21.0-alpine AS build
WORKDIR /repo
RUN corepack enable
# Workspace manifests first for a cached install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN corepack pnpm install --filter @fullstack/api... --frozen-lockfile
# API source + prisma schema, then generate the client and build dist/. The client is
# TypeScript under src/generated/, so it must exist before `nest build` compiles it into dist/.
COPY apps/api apps/api
COPY packages packages
# `prisma.config.ts` eagerly validates DATABASE_URL via env(); `prisma generate`
# never connects, so a throwaway build-only value is enough. It is NOT baked into
# the runtime image (this stage is discarded).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
      corepack pnpm --filter @fullstack/api exec prisma generate \
 && corepack pnpm --filter @fullstack/api... build
# Produce a self-contained, production-only deployment (no devDeps) at /prod.
# `pnpm deploy` flattens the workspace symlinks into a real node_modules and
# copies the project files (dist/, prisma/, prisma.config.ts, package.json).
# The compiled client in dist/generated/ needs only the `@prisma/client` runtime and
# `@prisma/adapter-pg`, which are production dependencies.
RUN corepack pnpm --filter @fullstack/api deploy --prod --legacy /prod

# ---- runtime stage ----
# Lean production image: the deployed prod tree only, run as an unprivileged user.
FROM node:24.21.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# wget (busybox) is used by the compose healthcheck against /health/live.
COPY --from=build /prod ./
USER node
EXPOSE 3000
# No published host port (only reachable as http://api:3000 on the Docker network).
# Migrations never run automatically — apply them manually:
#   docker compose [-f docker-compose.local.yml] run --rm api \
#     sh -c "node_modules/.bin/prisma migrate deploy"
# The seed runs from dist/ too: `node_modules/.bin/prisma db seed` runs `node dist/seed.js`.
CMD ["node", "dist/main"]
