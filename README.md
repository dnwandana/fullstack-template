# Fullstack Template

A production-ready monorepo for building multi-tenant SaaS applications. Combines a secure Express.js REST API with a Vue 3 SPA, wired together with JWT authentication, RBAC, an invitation system, and a full Organization → Project → Resource hierarchy.

## What's inside

| App        | Stack                              | Purpose                                 |
| ---------- | ---------------------------------- | --------------------------------------- |
| `apps/api` | Express 5, PostgreSQL, Knex.js     | REST API with auth, RBAC, multi-tenancy |
| `apps/app` | Vue 3, Pinia, Ant Design Vue, Vite | Single-page app consuming the API       |

## Architecture at a glance

```
Organization
  └── Projects
        └── Todos (example resource)
```

- **Multi-tenancy**: Shared PostgreSQL database, tenant-scoped via `org_id`/`project_id` columns
- **RBAC**: 4 system roles (owner / admin / member / viewer) + custom roles, 16 granular permissions
- **Auth**: Dual-token JWT via httpOnly cookies, Argon2 password hashing, password complexity, account lockout
- **Invitations**: Invite by username or email, 7-day expiry, accept/decline flow

## Prerequisites

- Node.js `>=24.0.0`
- Corepack (bundled with Node 24+)
- PostgreSQL (for the API)

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
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_GENERAL_MAX=100
LOG_LEVEL=info
LOG_TO_FILE=true
```

### App (`apps/app`)

```bash
cp apps/app/.env.example apps/app/.env
```

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Database setup

Run migrations and (optional) seed data:

```bash
cd apps/api
npm run migrate
npm run seed      # loads test users, orgs, projects, ~250 todos
```

## Development

```bash
# Start both apps
corepack pnpm dev

# Start individually
corepack pnpm dev:api   # http://localhost:3000
corepack pnpm dev:app   # http://localhost:8080
```

## Scripts

| Command       | Description                        |
| ------------- | ---------------------------------- |
| `pnpm dev`    | Start both apps in watch mode      |
| `pnpm build`  | Build both apps                    |
| `pnpm lint`   | Lint both apps                     |
| `pnpm test`   | Run all tests (API only currently) |
| `pnpm format` | Format both apps with Prettier     |

Append `:api` or `:app` to target a single workspace (e.g. `pnpm test:api`).

## API overview

### Authentication endpoints (public)

| Method | Path                | Description                                           |
| ------ | ------------------- | ----------------------------------------------------- |
| POST   | `/api/auth/signup`  | Register — returns `{ id, username, email }`          |
| POST   | `/api/auth/signin`  | Login — sets httpOnly auth cookies, returns user info |
| POST   | `/api/auth/refresh` | Rotate tokens via httpOnly cookie                     |
| POST   | `/api/auth/logout`  | Revoke refresh token, clear cookies                   |

### Protected endpoints (authenticated via httpOnly `access_token` cookie)

```
GET  /api/invitations                              # User's pending invitations
GET  /api/permissions                              # Permission reference list

POST /api/orgs                                     # Create org
GET  /api/orgs/:org_id                             # Get org
GET  /api/orgs/:org_id/members                     # List members
POST /api/orgs/:org_id/invitations                 # Invite to org

GET  /api/orgs/:org_id/projects                    # List projects
POST /api/orgs/:org_id/projects                    # Create project

GET  /api/orgs/:org_id/projects/:project_id/todos  # List todos (paginated)
POST /api/orgs/:org_id/projects/:project_id/todos  # Create todo

GET  /api/orgs/:org_id/roles                       # List roles
POST /api/orgs/:org_id/roles                       # Create custom role
```

Health check (no auth, not rate-limited):

```
GET /health    # { status, uptime, database } (production omits uptime/database)
```

### Response format

```json
{
  "message": "Success",
  "data": { ... },
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

### Authentication cookies

The API uses httpOnly cookies (not headers) for token management:

- `access_token` — httpOnly cookie, short-lived (default 15 min), scoped to `/api`
- `refresh_token` — httpOnly cookie, long-lived (default 7 days), scoped to `/api/auth`

Tokens are set by the server on signin/refresh and never exposed to JavaScript. Both use `Secure` (production), `SameSite=Strict`.

## Testing

```bash
corepack pnpm test:api
```

Tests require a PostgreSQL test database. Copy and configure:

```bash
cp apps/api/.env.example apps/api/.env.test
# Set DATABASE_URL to a separate test database
```

The test suite uses real PostgreSQL (no mocks), runs migrations before each session, and truncates tables between tests. 64 tests across unit (pagination, sanitize, http-error) and integration (auth, health, orgs, todos, permissions) suites.

## Deployment

Production deployment uses Docker Compose with nginx as the sole entry point. Two containers run on the host VM; PostgreSQL remains an external service.

### How it works

```
nginx (ports 80/443)
  ├── / → serves Vue static files (built into the image)
  ├── /api → proxies to Express container
  └── /health → proxies to Express container

api (internal only)
  └── connects to external PostgreSQL via DATABASE_URL
```

### Local Docker

Test the production images locally over HTTP (no SSL required).

**1. Configure environment**

```bash
cp .env.example .env.local
# Edit .env.local — fill in DATABASE_URL, JWT secrets, and set these local values:
#   NODE_ENV=development        ← required: keeps cookies non-Secure so browsers accept them over HTTP
#   JWT_ISSUER=http://localhost
#   JWT_AUDIENCE=http://localhost
#   CORS_ALLOWED_ORIGINS=http://localhost
```

**2. Build and start**

```bash
docker compose -f docker-compose.local.yml up --build -d
```

**3. Run migrations**

```bash
docker compose -f docker-compose.local.yml run --rm api sh -c "node_modules/.bin/knex migrate:latest"
```

App available at `http://localhost`.

**Useful commands**

```bash
docker compose -f docker-compose.local.yml logs -f        # tail all logs
docker compose -f docker-compose.local.yml logs -f api    # API logs only
docker compose -f docker-compose.local.yml ps             # container status
docker compose -f docker-compose.local.yml down           # stop and remove containers
```

### First deploy

**1. Place Let's Encrypt certificates**

```bash
mkdir certs
# Copy or symlink your certs — nginx expects these exact filenames:
# certs/fullchain.pem
# certs/privkey.pem
# Typical symlink approach (if using certbot on the host):
ln -s /etc/letsencrypt/live/<domain>/fullchain.pem certs/fullchain.pem
ln -s /etc/letsencrypt/live/<domain>/privkey.pem certs/privkey.pem
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT secrets, and your domain
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
docker compose run --rm api sh -c "node_modules/.bin/knex migrate:latest"

# Manual seed
docker compose run --rm api sh -c "node_modules/.bin/knex seed:run"
```

### Environment variables

| Variable               | Required | Description                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`    | No       | Build-time API base URL. Defaults to `/api` (same-origin, recommended).             |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                                                        |
| `ACCESS_TOKEN_SECRET`  | Yes      | JWT secret, min 32 chars                                                            |
| `REFRESH_TOKEN_SECRET` | Yes      | JWT secret, min 32 chars, must differ from access secret                            |
| `JWT_ISSUER`           | Yes      | e.g. `https://yourdomain.com`                                                       |
| `JWT_AUDIENCE`         | Yes      | e.g. `https://yourdomain.com`                                                       |
| `CORS_ALLOWED_ORIGINS` | No       | Defaults to `http://localhost:8080`. Set to `https://yourdomain.com` in production. |

See `.env.example` for the full list.

---

## Project structure

```
fullstack-template/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.js              # Express app (middleware + routes)
│   │   │   ├── index.js            # Entry point (env validation, server start)
│   │   │   ├── config/             # Database config
│   │   │   ├── controllers/        # Business logic + Joi validation
│   │   │   ├── models/             # Knex.js queries (no business logic)
│   │   │   ├── routes/             # Route definitions
│   │   │   ├── middlewares/        # Auth, tenant resolution, permission guards
│   │   │   └── utils/              # JWT, logging, response, pagination helpers
│   │   ├── database/
│   │   │   ├── migrations/         # 10 Knex migrations
│   │   │   └── seeds/              # 9 seed files (permissions, users, test data)
│   │   └── tests/
│   │       ├── integration/        # HTTP endpoint tests
│   │       └── unit/               # Utility unit tests
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

1. **Migration**: `npm run migrate:make create_<resource>_table` — add `org_id`/`project_id` FK for tenant scoping
2. **Model** (`src/models/<resource>.js`): Knex queries with tenant-scoped conditions
3. **Controller** (`src/controllers/<resource>.js`): Business logic using `req.org.id`/`req.project.id`
4. **Routes** (`src/routes/<resource>.js`): `Router({ mergeParams: true })`, apply `requirePermission()` guards
5. Wire into parent route file (e.g. `src/routes/projects.js`)
6. Add permissions to `01_permissions.js` seed; update `05_role_permissions.js`

## Code style

Both apps use the same conventions:

- **Formatter**: Prettier — no semicolons, 2-space indent, 100-char width
- **Linter**: Oxlint (API), Oxlint + ESLint (app)
- **Modules**: ES modules (`"type": "module"`)
- **File naming**: kebab-case

Run before committing:

```bash
corepack pnpm lint
corepack pnpm format
```
