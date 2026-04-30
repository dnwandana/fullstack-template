# CLAUDE.md

Monorepo root guidance. Each app has its own detailed `CLAUDE.md` — this file covers workspace-level concerns only.

## Workspace

- **Package manager**: pnpm with Corepack (`corepack pnpm <command>`)
- **Build orchestration**: Turborepo (`turbo.json`)
- **Packages**: `apps/api` (Express), `apps/app` (Vue 3)

## Root commands

```bash
corepack pnpm dev           # Start both apps (nodemon + Vite)
corepack pnpm dev:api       # API only  (port 3000)
corepack pnpm dev:app       # App only  (port 8080)
corepack pnpm build         # Build both
corepack pnpm lint          # Lint both
corepack pnpm format        # Format both (Prettier)
corepack pnpm test          # Test both (API only has tests currently)
corepack pnpm test:api      # Vitest + Supertest against real PostgreSQL
```

## Key architectural facts

- **Auth cookies**: `access_token` and `refresh_token` — httpOnly, Secure, SameSite=Strict cookies set by the server
- **Multi-tenancy**: Shared database, tenant isolation via `org_id`/`project_id` columns
- **RBAC**: `requirePermission(name)` middleware, permissions resolved on `req.permissions`
- **Request context**: `req.id` (request ID), `req.user`, `req.org`, `req.project`, `req.permissions`
- **Error handling**: Controllers throw `HttpError(status, msg)`, caught by centralized `errorHandler`
- **Env validation**: API fails fast at startup if required vars are missing (expected behavior)

## App-specific details

See [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) and [`apps/app/CLAUDE.md`](apps/app/CLAUDE.md).

## Docker deployment

Two compose files — same two-container architecture, PostgreSQL always external.

### Production (`docker-compose.yml`)

```bash
docker compose build          # build both images
docker compose up -d          # start detached
docker compose logs -f        # tail logs
docker compose ps             # check status
```

- nginx on ports 80 + 443, TLS via `certs/` (gitignored, mounted read-only)
- Uses `nginx/default.conf` (HTTP→HTTPS redirect + TLS block)
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

- `app` container: nginx serves Vue static files + proxies `/api` and `/health` to the `api` container
- `api` container: Express.js, no host port published, only reachable as `http://api:3000` inside Docker network
- Migrations do **not** run automatically — run manually: `docker compose [-f docker-compose.local.yml] run --rm api sh -c "node_modules/.bin/knex migrate:latest"`
