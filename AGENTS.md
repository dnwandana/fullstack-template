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
