# Fullstack Template

A production-ready monorepo for building multi-tenant SaaS applications. Combines a secure Express.js REST API with a Vue 3 SPA, wired together with JWT authentication, RBAC, an invitation system, and a full Organization → Project → Resource hierarchy.

## What's inside

| App | Stack | Purpose |
|-----|-------|---------|
| `apps/api` | Express 5, PostgreSQL, Knex.js | REST API with auth, RBAC, multi-tenancy |
| `apps/app` | Vue 3, Pinia, Ant Design Vue, Vite | Single-page app consuming the API |

## Architecture at a glance

```
Organization
  └── Projects
        └── Todos (example resource)
```

- **Multi-tenancy**: Shared PostgreSQL database, tenant-scoped via `org_id`/`project_id` columns
- **RBAC**: 4 system roles (owner / admin / member / viewer) + custom roles, 16 granular permissions
- **Auth**: Dual-token JWT (`x-access-token` + `x-refresh-token`), Argon2 password hashing
- **Invitations**: Invite by username or email, 7-day expiry, accept/decline flow

## Prerequisites

- Node.js `>=24.0.0`
- Corepack (bundled with Node 24+)
- PostgreSQL (for the API)

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

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both apps in watch mode |
| `pnpm build` | Build both apps |
| `pnpm lint` | Lint both apps |
| `pnpm test` | Run all tests (API only currently) |
| `pnpm format` | Format both apps with Prettier |

Append `:api` or `:app` to target a single workspace (e.g. `pnpm test:api`).

## API overview

### Authentication endpoints (public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register — returns `{ id, username, email }` |
| POST | `/api/auth/signin` | Login — returns tokens + user info |
| POST | `/api/auth/refresh` | Rotate access token via `x-refresh-token` header |

### Protected endpoints (require `x-access-token` header)

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
GET /health    # { status, db, uptime }
```

### Response format

```json
{
  "message": "Success",
  "data": { ... },
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

### Token headers

The API uses custom headers (not `Authorization: Bearer`):

- `x-access-token` — short-lived access token (default 15 min)
- `x-refresh-token` — long-lived refresh token (default 7 days)

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
