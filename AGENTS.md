# CLAUDE.md

Monorepo root guidance. Each app has its own detailed `CLAUDE.md` — this file covers workspace-level concerns only.

## Workspace

- **Package manager**: pnpm with Corepack (`corepack pnpm <command>`)
- **Build orchestration**: Turborepo (`turbo.json`)
- **Packages**: `apps/api` (NestJS 11 + Prisma, TypeScript → `dist/`), `apps/app` (Vue 3)

## Root commands

```bash
corepack pnpm dev           # Start both apps (nest --watch + Vite)
corepack pnpm dev:api       # API only  (port 3000)
corepack pnpm dev:app       # App only  (port 8080)
corepack pnpm build         # Build both
corepack pnpm lint          # Lint both
corepack pnpm format        # Format both (Prettier)
corepack pnpm test          # Test both apps
corepack pnpm test:api      # Jest (e2e) against real PostgreSQL
corepack pnpm test:app      # Vitest + jsdom + @vue/test-utils
```

## Key architectural facts

- **Auth cookies**: `access_token` and `refresh_token` — httpOnly, Secure, SameSite=Strict cookies set by the server
- **Multi-tenancy**: Shared database, tenant isolation via `org_id`/`project_id` columns
- **RBAC**: `@RequirePermission(name)` decorator enforced by `PermissionsGuard`; resolved permissions live on `req.permissions`
- **Request context**: `req.id` (request ID), `req.user`, `req.org`, `req.project`, `req.permissions`
- **Error handling**: Controllers/services throw NestJS `HttpException`s, caught by the global `AllExceptionsFilter` → `{ message, data: null }`
- **Env validation**: API fails fast at startup if required vars are missing (expected behavior)
- **Health probes**: `/health/live` (process only), `/health/ready` (database probe), `/health` (combined) — all three sit outside the `/api` prefix, are public, and skip rate limiting
- **API docs**: OpenAPI is generated at boot by `@nestjs/swagger` and served at `/api/docs`; gated by `SWAGGER_ENABLED`, which defaults to off in production. No spec file is checked in
- **Scheduled work**: `@nestjs/schedule` cron in `apps/api/src/maintenance/` prunes expired auth and invitation rows nightly, in bounded batches, each guarded by a Postgres advisory lock so replicas never duplicate work (`CLEANUP_ENABLED`)

## App-specific details

See [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) and [`apps/app/CLAUDE.md`](apps/app/CLAUDE.md).

## Docker deployment

Two compose files — production is a three-container topology (edge nginx + app + api), local dev stays two-container (app+nginx-in-one + api). PostgreSQL always external.

### Production (`docker-compose.yml`)

```bash
docker compose build          # build all three images
docker compose up -d          # start detached
docker compose logs -f        # tail logs
docker compose ps             # check status
```

- Three containers: `nginx` (edge, ports 80 + 443), `app` (internal only), `api` (internal only)
- `nginx` is a name-based virtual host router: `app.<DOMAIN>` → `app` container, `api.<DOMAIN>` → `api` container
- TLS via a single wildcard cert pair in `certs/` (gitignored, mounted read-only): `<DOMAIN>.fullchain.pem` / `<DOMAIN>.privkey.pem`
- Vhost config is rendered at container start from `nginx/templates/*.template` via envsubst, driven by `DOMAIN` in `.env`
- Env from `.env`

### Local (`docker-compose.local.yml`)

```bash
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.local.yml logs -f
docker compose -f docker-compose.local.yml down
```

- nginx on port 80 only, no TLS
- Uses `nginx/local.conf` (HTTP-only)
- Env from `.env.local` (copy from `.env.example`; set `NODE_ENV=development`, `JWT_ISSUER/AUDIENCE=http://localhost`, `CORS_ALLOWED_ORIGINS=http://localhost`)
- `NODE_ENV=development` is required locally — the API sets `Secure` cookies only in production, which browsers reject over plain HTTP

### Common facts

- `app` container: nginx serves Vue static files only in production (no `/api` proxying — the edge nginx routes `api.<DOMAIN>` straight to the `api` container); in local dev it still proxies `/api` and `/health` since `docker-compose.local.yml` stays single-origin
- `api` container: NestJS (Node, runs `node dist/main`), no host port published, only reachable as `http://api:3000` inside Docker network
- In production, the edge nginx strips the `/api` prefix from both the proxied path and `Set-Cookie` paths (`proxy_cookie_path`), so `api.<DOMAIN>` presents clean URLs while the API still mounts routes at `/api` unmodified via `setGlobalPrefix("api", { exclude: ["health", "health/live", "health/ready"] })` in `apps/api/src/bootstrap.ts`. Each `exclude` entry is an **exact** path, not a prefix — `"health"` alone would not cover `health/live`
- Container healthchecks in both compose files probe `http://localhost:3000/health/live` from inside the `api` container, so they never traverse nginx
- Migrations do **not** run automatically — run manually: `docker compose [-f docker-compose.local.yml] run --rm api sh -c "node_modules/.bin/prisma migrate deploy"`
