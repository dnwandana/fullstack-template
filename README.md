# Fullstack Template

A production-ready monorepo for building multi-tenant SaaS applications. Combines a secure NestJS REST API with a Vue 3 SPA, wired together with JWT authentication, RBAC, an invitation system, and a full Organization → Project → Resource hierarchy.

## What's inside

| App        | Stack                              | Purpose                                 |
| ---------- | ---------------------------------- | --------------------------------------- |
| `apps/api` | NestJS 11, PostgreSQL, Prisma      | REST API with auth, RBAC, multi-tenancy |
| `apps/app` | Vue 3, Pinia, Ant Design Vue, Vite | Single-page app consuming the API       |

## Architecture at a glance

```
Organization
  └── Projects
        └── Todos (example resource)
```

- **Multi-tenancy**: Shared PostgreSQL database, tenant-scoped via `org_id`/`project_id` columns
- **RBAC**: 4 system roles (owner / admin / member / viewer) + custom roles, 17 granular permissions. Cross-project visibility is a permission (`project:read_all`), not a hard-coded role name
- **Auth**: Dual-token JWT via httpOnly cookies, Argon2 password hashing, password complexity, account lockout, token-based password reset, and refresh-token reuse detection
- **Invitations**: Invite by email with an accept/decline/revoke/resend flow. In short: creating an invitation issues a raw token (stored only as a hash) that expires after 7 days; the public `/invite/:id?token=…` landing page previews the invitation while logged out — possession of the raw token is the only credential; accepting requires being logged in **and** presenting that token in the request body; project invitations auto-add the invitee to the parent org as a viewer. Inviting an address with no account creates a pending-account invitation; signing up claims it. Email delivery is a single documented seam — no mail provider is shipped.

## Prerequisites

- Node.js `>=24.0.0`
- Corepack (bundled with Node 24+)
- PostgreSQL (for the API)

Node 24+ is a hard floor, not a preference: `apps/api/prisma.config.ts` runs the database seed as `node prisma/seed.ts`, relying on Node's native TypeScript type-stripping (no ts-node/tsx is installed). Node ≤ 22 fails there with a confusing syntax error.

For production deployment:

- Docker Engine `>=24`
- Docker Compose `>=2.20`

## Install

```bash
corepack pnpm install
```

## Environment setup

### API (`apps/api`)

```bash
cp apps/api/.env.example apps/api/.env
```

Required variables:

```bash
DATABASE_URL=postgresql://user:pass@localhost/dbname
ACCESS_TOKEN_SECRET=<at-least-32-characters>
REFRESH_TOKEN_SECRET=<at-least-32-characters>
JWT_ISSUER=https://api.example.com
JWT_AUDIENCE=https://api.example.com
```

Optional (with defaults):

```bash
NODE_ENV=development
PORT=3000
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=http://localhost:8080
APP_BASE_URL=http://localhost:8080
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_GENERAL_MAX=1000
LOG_LEVEL=info
CLEANUP_ENABLED=true
# SWAGGER_ENABLED=true  # leave unset: derives to true outside production, false in production
```

### App (`apps/app`)

```bash
cp apps/app/.env.example apps/app/.env
```

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Database setup

Run Prisma migrations and (optional) seed data:

```bash
cd apps/api
npm run db:migrate   # prisma migrate deploy
npm run db:seed      # prisma db seed — inserts the 17 canonical permissions idempotently
```

Migrations never run automatically — apply them explicitly on every environment.

## Development

```bash
# Start both apps
corepack pnpm dev

# Start individually
corepack pnpm dev:api   # http://localhost:3000
corepack pnpm dev:app   # http://localhost:8080
```

## Scripts

| Command       | Description                    |
| ------------- | ------------------------------ |
| `pnpm dev`    | Start both apps in watch mode  |
| `pnpm build`  | Build both apps                |
| `pnpm lint`   | Lint both apps                 |
| `pnpm test`   | Run all tests (API + app)      |
| `pnpm format` | Format both apps with Prettier |

Append `:api` or `:app` to target a single workspace (e.g. `pnpm test:api`).

## API overview

### Authentication endpoints (public)

| Method | Path                                              | Description                                                                   |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `/api/auth/signup`                                | Register — returns `{ id, name, email }`                                      |
| POST   | `/api/auth/signin`                                | Login — sets httpOnly auth cookies, returns user info                         |
| POST   | `/api/auth/refresh`                               | Rotate tokens via httpOnly cookie                                             |
| POST   | `/api/auth/logout`                                | Revoke refresh token, clear cookies                                           |
| POST   | `/api/auth/forgot-password`                       | Request a reset link — always 200, never reveals whether the account exists   |
| POST   | `/api/auth/reset-password`                        | Consume a single-use 64-hex reset token and set a new password                |
| GET    | `/api/invitations/:invitation_id/preview?token=…` | Preview an invitation while logged out — the raw token is the only credential |

### Protected endpoints (authenticated via httpOnly `access_token` cookie)

```
GET  /api/invitations                              # User's pending invitations
GET  /api/permissions                              # Permission reference list

POST /api/orgs                                     # Create org
GET  /api/orgs/:org_id                             # Get org
GET  /api/orgs/:org_id/members                     # List members
POST /api/orgs/:org_id/invitations                 # Invite to org
POST /api/orgs/:org_id/invitations/:id/resend      # Reissue link (new token, resets expiry)

GET  /api/orgs/:org_id/projects                    # List projects
POST /api/orgs/:org_id/projects                    # Create project

GET  /api/orgs/:org_id/projects/:project_id/todos  # List todos (paginated)
POST /api/orgs/:org_id/projects/:project_id/todos  # Create todo

GET  /api/orgs/:org_id/roles                       # List roles
POST /api/orgs/:org_id/roles                       # Create custom role
```

Health checks (no auth, not rate-limited, outside the `/api` prefix):

```
GET /health/live    # liveness — process only, never touches the database; always 200
GET /health/ready   # readiness — database probe; 200 ready, 503 not_ready
GET /health         # combined check; 200 healthy, 503 unhealthy
```

All three return `{ status, timestamp }`. `/health/ready` and `/health` also include `uptime` and `database` outside production; `/health/live` never does — it is a fixed, dependency-free response. The container healthchecks in both compose files probe `/health/live` from inside the `api` container.

Note that the production edge nginx publishes health with an **exact** match (`location = /health`), so only `https://api.<DOMAIN>/health` is reachable from outside; the `live`/`ready` sub-paths are internal-only unless you widen that `location` to a prefix match. The local HTTP stack already uses a prefix match, so all three work there.

### Interactive API docs

The OpenAPI document is generated from the controllers and DTOs at boot by `@nestjs/swagger` and served at `/api/docs` (e.g. `http://localhost:3000/api/docs` in dev). There is no checked-in spec file to keep in sync. `SWAGGER_ENABLED` gates it and defaults to `false` when `NODE_ENV=production`.

### Response format

```json
{
  "message": "OK",
  "data": { ... },
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 42,
    "items_per_page": 10,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  }
}
```

Errors come back as `{ "message": "…", "data": null, "request_id": "…" }` with the failing request's correlation id.

### Authentication cookies

The API uses httpOnly cookies (not headers) for token management:

- `access_token` — httpOnly cookie, short-lived (default 15 min), scoped to `/api`
- `refresh_token` — httpOnly cookie, long-lived (default 7 days), scoped to `/api/auth`

Each cookie's lifetime is derived from `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN`, so the cookie and the JWT it carries always expire together. Both variables use the grammar `<number><s|m|h|d>` (e.g. `15m`, `7d`).

Tokens are set by the server on signin/refresh and never exposed to JavaScript. Both use `Secure` (production), `SameSite=Strict`. Refresh tokens rotate on every use, and replaying an already-revoked one revokes the user's entire refresh-token family.

### Security trade-offs

Four behaviors are deliberate design decisions, not omissions — don't "fix" them without revisiting the reasoning:

- **Org 404 vs 403** — a non-member requesting a real org gets `403`; an unknown org id gets `404`. This discloses org existence to authenticated users and is intentional (specified in the NestJS rebuild design): org ids are UUIDs, so enumeration is impractical, and the split gives a would-be member a correct error. Projects do **not** make this distinction — unknown and forbidden are both `404`.
- **Signup enumeration** — `POST /api/auth/signup` says when an email is already taken. Signin and forgot-password are hardened against enumeration; signup is not, because the "if an account exists we've emailed you" pattern requires real email delivery, which the template does not ship. Revisit when a mailer lands.
- **SameSite=Strict cookies** — the SPA and API must share a registrable domain (the shipped `app.<DOMAIN>` / `api.<DOMAIN>` topology qualifies). Splitting them across registrable domains silently breaks auth; changing this means editing `cookie.service.ts`, not an env var.
- **Invitation-only membership** — there is no direct "add member" endpoint by design. Membership is created only by accepting an invitation (or by creating the org/project), so every join is invitee-consented and auditable through the invitation flow.

## Testing

### API (`apps/api`)

```bash
corepack pnpm test:api
```

Tests require a PostgreSQL test database. Copy the committed test template:

```bash
cp apps/api/.env.test.example apps/api/.env.test
# Adjust DATABASE_URL to point at your test database
```

`.env.test.example` ships valid dummy secrets and generous rate limits — the app boots from it as-is. Do **not** copy `.env.example` for tests: its `changeme_…` secrets are rejected by env validation at startup by design.

The suite is a single Jest e2e run (`jest --config test/jest-e2e.json`) that boots the real NestJS app with Supertest against real PostgreSQL (no mocks), applies migrations, seeds the permissions, and truncates tables between tests. It exercises every module end to end — auth, health, orgs, roles, members, projects, todos, permissions, and invitations.

### App (`apps/app`)

```bash
corepack pnpm test:app
```

Vitest with jsdom and `@vue/test-utils`. Tests mock exactly one application boundary — `@/utils/http` — and exercise the real composables, stores, and API service layer, so a wrong argument order anywhere in the chain fails the test. (`vue-router` and Ant Design Vue's `message` are stubbed only as environment shims.)

## Deployment

Production deployment uses Docker Compose with an edge nginx container as a name-based virtual host router, splitting the SPA and API onto separate subdomains (`app.<DOMAIN>`, `api.<DOMAIN>`). Three containers run on the host VM; PostgreSQL remains an external service. This same-registrable-domain layout is what makes the `SameSite=Strict` auth cookies work — see [Security trade-offs](#security-trade-offs).

### How it works

```
nginx (edge, ports 80/443, name-based virtual host router)
  ├── app.<DOMAIN> → proxies to app container
  └── api.<DOMAIN> → proxies to api container, stripping the /api prefix
                      from both the request path and Set-Cookie paths

app (internal only)
  └── nginx serving the built Vue static files

api (internal only)
  └── connects to external PostgreSQL via DATABASE_URL
```

### Local Docker

Test the production images locally over HTTP (no SSL required). Unlike production, the local stack ships its own PostgreSQL container — three containers total (`app`, `api`, `postgres`), no external database needed.

**1. Configure environment**

```bash
cp .env.example .env.local
# Edit .env.local — fill in JWT secrets, and set these local values:
#   NODE_ENV=development        ← required: keeps cookies non-Secure so browsers accept them over HTTP
#   JWT_ISSUER=http://localhost
#   JWT_AUDIENCE=http://localhost
#   CORS_ALLOWED_ORIGINS=http://localhost
#   APP_BASE_URL=http://localhost   ← base of invitation accept links
#   DATABASE_URL=postgresql://pg_user:pg_password@postgres:5432/fullstack_template
#     ← the hostname is the compose service name "postgres", not localhost
```

**2. Build and start**

```bash
docker compose -f docker-compose.local.yml up --build -d
```

**3. Run migrations**

```bash
docker compose -f docker-compose.local.yml run --rm api sh -c "node_modules/.bin/prisma migrate deploy"
```

App available at `http://localhost`.

**Useful commands**

```bash
docker compose -f docker-compose.local.yml logs -f        # tail all logs
docker compose -f docker-compose.local.yml logs -f api    # API logs only
docker compose -f docker-compose.local.yml ps             # container status
docker compose -f docker-compose.local.yml down           # stop and remove containers
docker compose -f docker-compose.local.yml down -v        # …and wipe the postgres_data volume
```

Database data persists across restarts in the named `postgres_data` volume; `down -v` deletes it. Production has no bundled database — point `DATABASE_URL` at a managed/external PostgreSQL instance.

### First deploy

**1. Place Let's Encrypt certificates**

A single wildcard cert pair covers both subdomains.

```bash
mkdir certs
# Copy or symlink your certs — nginx expects these exact filenames,
# prefixed with your DOMAIN value from .env:
# certs/<DOMAIN>.fullchain.pem
# certs/<DOMAIN>.privkey.pem
# Typical symlink approach (if using certbot on the host, wildcard cert for *.<domain>):
ln -s /etc/letsencrypt/live/<domain>/fullchain.pem certs/<domain>.fullchain.pem
ln -s /etc/letsencrypt/live/<domain>/privkey.pem certs/<domain>.privkey.pem
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT secrets, and DOMAIN
```

**3. Build and start**

```bash
docker compose build
docker compose up -d
```

### Re-deploy after code changes

```bash
docker compose build
docker compose up -d
```

### Useful commands

```bash
docker compose logs -f              # tail logs from both containers
docker compose logs -f api          # API logs only
docker compose ps                   # container status

# Manual database migration (run before deploying schema changes)
docker compose run --rm api sh -c "node_modules/.bin/prisma migrate deploy"

# Manual seed
docker compose run --rm api sh -c "node_modules/.bin/prisma db seed"
```

### Environment variables

| Variable               | Required | Description                                                                                                                                                                             |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DOMAIN`               | Yes      | Registrable domain. Production derives `app.<DOMAIN>` (SPA) and `api.<DOMAIN>` (API) from it.                                                                                           |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                                                                                                                                                            |
| `ACCESS_TOKEN_SECRET`  | Yes      | JWT secret, min 32 chars                                                                                                                                                                |
| `REFRESH_TOKEN_SECRET` | Yes      | JWT secret, min 32 chars, must differ from access secret                                                                                                                                |
| `JWT_ISSUER`           | Yes      | e.g. `https://api.yourdomain.com`                                                                                                                                                       |
| `JWT_AUDIENCE`         | Yes      | e.g. `https://app.yourdomain.com`                                                                                                                                                       |
| `CORS_ALLOWED_ORIGINS` | No       | Defaults to `http://localhost:8080`. Set to `https://app.yourdomain.com` in production.                                                                                                 |
| `APP_BASE_URL`         | No\*     | Public SPA origin used to build invitation accept links. Defaults to `http://localhost:8080` — set `https://app.<DOMAIN>` in production, `http://localhost` for the local Docker stack. |
| `SWAGGER_ENABLED`      | No       | Serves the generated OpenAPI spec and Swagger UI at `/api/docs`. Defaults to `false` when `NODE_ENV=production`, `true` otherwise.                                                      |
| `CLEANUP_ENABLED`      | No       | Runs the nightly cleanup cron job that prunes expired refresh/reset tokens and dead invitations. Defaults to `true`.                                                                    |

\* Optional to the validator, effectively required in production: the default produces invitation links pointing at `localhost`.

See `.env.example` for the full list.

---

## Project structure

```
fullstack-template/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts             # Entry point — creates the Nest app, calls configureApp, listens
│   │   │   ├── bootstrap.ts        # helmet/cors/cookie-parser, setGlobalPrefix("api"), pino logger, Swagger
│   │   │   ├── app.module.ts       # Root module: global pipe/filter/interceptor/guards + feature modules
│   │   │   ├── prisma/             # PrismaService (Prisma client lifecycle)
│   │   │   ├── auth/               # Sign in/up, password reset, JWT, cookies, refresh-token rotation
│   │   │   ├── tenancy/            # Org/Project/Permissions guards + membership resolution
│   │   │   ├── maintenance/        # CleanupService — nightly cron pruning expired auth/invitation rows
│   │   │   ├── common/             # Envelope interceptor, exception filter, decorators, DTO helpers
│   │   │   ├── config/             # env.validation.ts (Joi, fail-fast at startup), pino.config.ts
│   │   │   └── users, permissions, orgs, roles, members, projects, todos, invitations, health/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 12 domain models (@map/@@map keep the DB snake_case)
│   │   │   ├── migrations/         # Prisma migrations (0_init baseline + subsequent)
│   │   │   └── seed.ts             # Idempotent seed of the 17 canonical permissions
│   │   └── test/                   # Jest e2e suite (Supertest against real PostgreSQL)
│   │
│   └── app/
│       └── src/
│           ├── api/                # HTTP service layer (pure fetch calls)
│           ├── stores/             # Pinia stores (state + API orchestration)
│           ├── composables/        # Bridge: stores → components
│           ├── views/              # Routed page components
│           ├── components/         # Reusable UI components
│           ├── router/             # Vue Router + auth guards
│           └── utils/              # Fetch client, localStorage helpers
│
├── package.json                    # Monorepo root
├── pnpm-workspace.yaml
└── turbo.json
```

## Adding a new resource

See [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) for the full recipe. In short:

1. **Module/service/controller**: `nest g module <resource>` (+ service, + controller), or add them by hand under `src/<resource>/`
2. **Prisma**: add the model to `prisma/schema.prisma` with an `org_id`/`project_id` FK for tenant scoping, then `prisma migrate dev`
3. **Service**: inject `PrismaService`, scope every query by `org.id`/`project.id`
4. **Controller**: `@Controller("orgs/:org_id/projects/:project_id/<resource>")`, `@UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)`, `@RequirePermission("<name>")` per handler; return `{ message, data, pagination? }`
5. **Permissions**: add any new permission names to `prisma/seed.ts` (`PERMISSION_NAMES`) and to `src/orgs/system-roles.ts` (`SYSTEM_ROLE_PERMISSIONS`)

## Code style

- **Formatter**: Prettier — no semicolons, 2-space indent, 100-char width
- **Linter**: Oxlint (API), Oxlint + ESLint (app)
- **Modules**: API is TypeScript (NestJS, compiled to `dist/`); the app is ES modules (`"type": "module"`)
- **File naming**: kebab-case

Run before committing:

```bash
corepack pnpm lint
corepack pnpm format
```
