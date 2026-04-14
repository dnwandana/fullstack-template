# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant Express.js RESTful API template with Organization → Project → Resource hierarchy, PostgreSQL, Knex.js, JWT authentication, and RBAC permissions. ES Modules (`"type": "module"`), Node.js v24+ (pinned in `.nvmrc`).

## Commands

```bash
npm run dev              # Development server with nodemon
npm start                # Production server
npm test                 # Run tests (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run lint             # Oxlint (linter)
npm run lint:fix         # Auto-fix lint issues
npm run format           # Prettier check
npm run format:fix       # Prettier fix
npm run migrate          # Run latest migrations
npm run migrate:make <n> # Create migration
npm run migrate:rollback # Rollback last migration
npm run seed             # Run all seeds
npm run seed:make <n>    # Create seed file
```

No pre-commit hooks. Run `npm run lint:fix && npm run format:fix` before committing.

## Architecture

### MVC Pattern

- **Models** (`src/models/`): Knex.js queries only — no business logic
- **Controllers** (`src/controllers/`): Business logic, Joi validation, coordinates models
- **Routes** (`src/routes/`): Route definitions + param validation middleware, aggregated in `routes/index.js`
- **Middleware** (`src/middlewares/`): Authorization (JWT), tenant resolution (`resolveOrg`, `resolveProject`), permission guards (`requirePermission`)

### Middleware Order (critical — in `src/app.js`)

1. Request ID (`requestId` — must be first so all downstream middleware can use `req.id`)
2. Security (helmet with strict CSP, cors with explicit origins)
3. Body parsing (express.json + express.urlencoded, both 100kb limit)
4. HPP (HTTP Parameter Pollution protection)
5. Health check (`/health` — before rate limiting so load balancers aren't throttled)
6. Rate limiting (generalLimiter — global, configurable via `RATE_LIMIT_GENERAL_MAX`)
7. Logging (Morgan httpLogger + custom requestLogger)
8. Routes (`/api`):
   - `/api/auth/*` — auth routes (authLimiter)
   - `requireAccessToken` — all routes below are authenticated
   - `/api/invitations` — user's pending invitations
   - `/api/permissions` — permission reference
   - `/api/orgs` — org routes (resolveOrg applied at route level)
     - `/:org_id/projects` — project routes (resolveProject at route level)
       - `/:project_id/todos` — project-scoped todos
       - `/:project_id/members` — project members
       - `/:project_id/invitations` — project invitations
     - `/:org_id/roles` — org roles
     - `/:org_id/members` — org members
     - `/:org_id/invitations` — org invitations
9. 404 handler (notFoundHandler)
10. Error handler (errorHandler) — **must be last**

`trust proxy` is set to `1` so rate limiting works correctly behind reverse proxies.

### App Extraction (`src/app.js` vs `src/index.js`)

`src/app.js` configures Express (middleware, routes) and exports the app without calling `listen()`. `src/index.js` is the thin entry point: loads env, validates it, dynamically imports `app.js`, then starts the server. This split enables Supertest to import the app directly without binding to a port.

### Request ID Tracking

`src/middlewares/request-id.js` runs first in the middleware chain. Accepts an incoming `X-Request-Id` header (up to 128 chars) or generates a UUID via `crypto.randomUUID()`. Stores on `req.id`, echoes in the response `X-Request-Id` header. All logs (Morgan, requestLogger, errorHandler, notFoundHandler) include `requestId: req.id`.

### Health Check

`GET /health` — mounted before rate limiting so load balancers aren't throttled. Returns DB connectivity status (`SELECT 1`), uptime, and timestamp. Uses `apiResponse()` wrapper. Returns 200 when healthy, 503 when DB is unreachable.

### Request Context Flow

Authorization middleware sets `req.user = { id }` from decoded JWT. Tenant resolution middleware builds up context:

- `resolveOrg` (on `/:org_id` routes): validates org_id UUID, loads org (404 if not found), verifies membership (403 if not member), loads permissions → sets `req.org = { id }` and `req.permissions = [...]`
- `resolveProject` (on `/:project_id` routes): validates project_id UUID, loads project scoped to org (404 if not found), merges project-level permissions with org-level permissions → sets `req.project = { id }`
- `requirePermission(name)`: higher-order middleware that checks `req.permissions.includes(name)`, returns 403 if missing

**Permission Resolution**: Project permissions merge with org permissions (deduped). Org admins automatically have access to all projects without explicit project membership.

**Request properties (lean context)**:

```
req.id          // Request ID (from requestId middleware)
req.user        // { id } from JWT
req.org         // { id } from resolveOrg
req.project     // { id } from resolveProject
req.permissions // ["todos:create", ...] merged org + project permissions
```

### Authentication Flow

- POST `/api/auth/signup` → creates user, returns `{ id, username, email }` (no tokens). Email is optional.
- POST `/api/auth/signin` → returns `{ id, username, access_token, refresh_token }`
- POST `/api/auth/refresh` → returns new access token only

Token headers: `x-access-token` and `x-refresh-token` (NOT `Authorization: Bearer`). JWT algorithm pinned to HS256 with explicit verification.

Validation: username 3–30 chars, alphanumeric + `.` `_` `-` only. Password 8–72 chars (72 is Argon2's input limit). Email optional, max 255 chars, unique if provided. Auth routes are rate-limited via `authLimiter` (default 10 req/15min).

### Multi-Tenancy Architecture

**Hierarchy**: Organization → Project → Resources (Todos)

**Data isolation**: Shared database with tenant columns (`org_id`, `project_id`). No schema-per-tenant.

**Membership**: Users can belong to multiple orgs and multiple projects within each org (like GitHub).

**RBAC**: Permission-per-Role table pattern. System roles (owner/admin/member/viewer) created per org. Org owners can create custom roles with granular permissions. 16 system permissions across org, project, todos, and invitations resources.

**System Roles**:
| Role | Permissions |
| ------ | --------------------------------------- |
| owner | All 16 permissions |
| admin | All except org:delete, org:manage_roles |
| member | org:read, project:read, todos CRUD |
| viewer | org:read, project:read, todos:read |

**Nested REST URLs**: `/api/orgs/:org_id/projects/:project_id/todos`

**Invitation System**: Invite by username or email, 7-day expiry, accept/decline flow. Project invitations auto-add to org as viewer if not already a member.

### Error Handling

Controllers throw `HttpError(status, message)` → caught by `next(error)` → centralized `errorHandler` logs full context (requestId, stack, IP, userId, method, URL) but only returns `{ message }` to client. Controllers should **not** log errors themselves — the centralized handler is the single logging point. Stack traces are only logged outside production. `notFoundHandler` logs 404s with user-agent tracking.

### Environment Validation

`src/utils/validate-env.js` runs at the very top of `src/index.js`, **before** Express initializes. Validates all required env vars with Joi (`abortEarly: false` to report all errors at once). JWT secrets must be ≥32 characters. Validated values are written back to `process.env`. Fails with `process.exit(1)` — not HttpError (Express doesn't exist yet).

### Pagination & Search

`src/utils/pagination.js` exports three functions:

- `validatePaginationQuery(query, sortableColumns)` — validates page, limit, sort_by, sort_order, search
- `buildPaginationMeta(page, limit, totalItems)` — pagination metadata object
- `executePaginatedQuery(countFn, findFn, conditions, params, searchableColumns)` — runs count + data fetch in parallel

Search input is sanitized via `escapeIlike()` from `src/utils/sanitize.js` — escapes `%`, `_`, and `\` so they are treated as literals in PostgreSQL ILIKE patterns.

**Usage in controllers:**

```javascript
import { validatePaginationQuery, executePaginatedQuery } from "../utils/pagination.js"

const params = validatePaginationQuery(req.query, ["updated_at", "title"])
const { data: todos, pagination } = await executePaginatedQuery(
  model.count,
  model.findManyPaginated,
  { project_id: req.project.id },
  params,
  ["title"],
)
return res.json(apiResponse({ data: todos, pagination }))
```

**Model contract:** Models must expose `count(conditions, options)` and `findManyPaginated(conditions, options)` where options supports `{ search, searchColumns, limit, offset, orders }`. Search uses `ILIKE %term%` on specified columns.

### Bulk Delete

DELETE `/api/orgs/:org_id/projects/:project_id/todos?ids=id1,id2,id3` — comma-separated UUIDs in query string. Validated: max 50 IDs, each must be a valid UUID. Uses `removeMany(ids, conditions)` with `whereIn` for a single query instead of per-ID deletes.

## Code Style

- **Formatter**: Prettier — no semicolons, 2-space indent, 100 char width
- **Linter**: Oxlint — correctness (error), suspicious (warn)
- **File naming**: kebab-case (`http-error.js`, `validate-env.js`)
- **UUIDs**: Use `crypto.randomUUID()` from `node:crypto` (not uuid package)
- **Imports**: ES modules only. Models use named exports. Controllers imported as namespace (`import * as controller`)
- **Responses**: Always use `apiResponse({ message, data, pagination })` from `src/utils/response.js`. Pass resource directly as `data` (object for single, array for list, `null` for delete/error). For paginated lists, pass the array as `data` and metadata as `pagination`.

## Environment Variables

Required: `DATABASE_URL`, `ACCESS_TOKEN_SECRET` (≥32 chars), `REFRESH_TOKEN_SECRET` (≥32 chars), `JWT_ISSUER`, `JWT_AUDIENCE`

Optional with defaults: `NODE_ENV` (development), `PORT` (3000), `ACCESS_TOKEN_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `LOG_LEVEL` (info), `LOG_TO_FILE` (true), `CORS_ALLOWED_ORIGINS` (http://localhost:8080), `RATE_LIMIT_AUTH_MAX` (10), `RATE_LIMIT_GENERAL_MAX` (100)

## Database

- **Config**: `knexfile.js` — connection pool min 2, max 10
- **Migrations**: `database/migrations/` — format `YYYYMMDDHHMMSS_name.js`
  - 10 migration files: users, organizations, permissions, roles, role_permissions, org_members, projects, project_members, invitations, todos
- **Seeds**: `database/seeds/` — 9 seed files:
  - 01: 16 system permissions
  - 02: 5 test users (password: "secretpassword", with emails)
  - 03: 2 organizations (Acme Corp, Globex Corporation)
  - 04: 8 system roles (4 per org: owner/admin/member/viewer)
  - 05: Role-permission mappings
  - 06: 7 org memberships
  - 07: 3 projects
  - 08: 8 project memberships
  - 09: ~250 project-scoped todos
- Tables use `timestamps(true, true)` for timezone-aware created_at/updated_at
- Organizations cascade delete to projects, todos, members, invitations
- Projects cascade delete to todos, project_members
- Roles are org-scoped with UNIQUE(org_id, name)

## Adding a New Resource

1. Migration: `npm run migrate:make create_<resource>_table` — include `org_id` or `project_id` foreign key for tenant scoping
2. Model: `src/models/<resource>.js` — CRUD with tenant-scoped conditions
3. Controller: `src/controllers/<resource>.js` — Use `req.org.id` / `req.project.id` for scoping, Joi validation inline
4. Routes: `src/routes/<resource>.js` — Use `Router({ mergeParams: true })` for nested routes, apply `requirePermission()` guards
5. Wire up in parent route file (e.g., `src/routes/projects.js` for project-scoped resources)
6. Add permissions to `database/seeds/01_permissions.js` and update role mappings in `05_role_permissions.js`

## Testing

- **Runner**: Vitest with `globals: true` (no explicit `describe`/`it` imports needed)
- **HTTP**: Supertest for integration tests against the Express app
- **Database**: Real PostgreSQL test database (`express_template_test` on same cluster, configured in `.env.test`)
- **Config**: `vitest.config.js` — `fileParallelism: false` (integration tests share DB state)
- **Setup**: `tests/global-setup.js` — loads `.env.test`, validates env, runs migrations, truncates all tables, seeds permissions; returns teardown function
- **Helpers**: `tests/helpers.js`:
  - `getApp()`, `request()` — app bootstrapping
  - `createTestUser()`, `getAuthHeaders()` — authentication
  - `createTestOrg()` — creates org with system roles, adds creator as owner
  - `createTestProject()` — creates project within org, adds creator as member
  - `addOrgMember()`, `addProjectMember()` — membership setup
  - `cleanAllTables()` — truncates all tables except permissions
  - `seedPermissions()` — seeds 16 system permissions (called once in global setup)
- **Structure**: `tests/unit/` for pure logic, `tests/integration/` for HTTP endpoints
- **Convention**: Each integration test file calls `cleanAllTables()` in `beforeEach` or `afterEach`. Permissions persist across tests (seeded once in global setup).
