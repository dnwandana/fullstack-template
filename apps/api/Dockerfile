# syntax=docker/dockerfile:1

# ---- build stage ----
# Full workspace install + Prisma client generation + TypeScript compile.
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
# Workspace manifests first for a cached install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
RUN corepack pnpm install --filter @fullstack/api... --frozen-lockfile
# API source + prisma schema, then generate the client and build dist/.
# `prisma generate` runs INSIDE alpine, so the emitted query engine is the
# linux-musl target the runtime stage needs.
COPY apps/api apps/api
# `prisma.config.ts` eagerly validates DATABASE_URL via env(); `prisma generate`
# never connects, so a throwaway build-only value is enough. It is NOT baked into
# the runtime image (this stage is discarded).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
      corepack pnpm --filter @fullstack/api exec prisma generate \
 && corepack pnpm --filter @fullstack/api build
# Produce a self-contained, production-only deployment (no devDeps) at /prod.
# `pnpm deploy` flattens the workspace symlinks into a real node_modules and
# copies the project files (dist/, prisma/, prisma.config.ts, package.json).
RUN corepack pnpm --filter @fullstack/api deploy --prod --legacy /prod
# `prisma` and `@prisma/client` are production dependencies, so `pnpm deploy --prod`
# already ships the CLI (`.bin/prisma` for `migrate deploy`/`db seed`). It does NOT,
# however, ship the *generated* client — `prisma generate`'s output lives beside the
# store package and its postinstall can't regenerate without the schema/DB. Re-inject
# just that artifact (the musl query engine) so the app boots. Store hash is globbed
# to stay lockfile-agnostic; assert exactly one match on each side so a future
# multi-version graph fails the build loudly instead of silently copying the wrong
# query engine (which would only surface as a boot crash in the runtime image).
RUN set -eux; \
    cd /prod/node_modules; \
    CLIENT_SRC="$(ls -d /repo/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma)"; \
    CLIENT_DST="$(ls -d .pnpm/@prisma+client@*/node_modules)"; \
    test "$(printf '%s\n' "$CLIENT_SRC" | wc -l)" -eq 1; \
    test "$(printf '%s\n' "$CLIENT_DST" | wc -l)" -eq 1; \
    cp -R "$CLIENT_SRC" "$CLIENT_DST/"

# ---- runtime stage ----
# Lean production image: the deployed prod tree only, run as an unprivileged user.
FROM node:24-alpine AS runtime
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
CMD ["node", "dist/main"]
