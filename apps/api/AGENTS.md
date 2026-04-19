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
5. Cookie parsing (cookie-parser — populates `req.cookies` for auth token access)
6. Health check (`/health` — before rate limiting so load balancers aren't throttled)
7. Rate limiting (generalLimiter — global, configurable via `RATE_LIMIT_GENERAL_MAX`)
8. Logging (Morgan httpLogger + custom requestLogger)
9. Routes (`/api`):
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
10. 404 handler (notFoundHandler)
11. Error handler (errorHandler) — **must be last**

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
- POST `/api/auth/signin` → stores refresh token hash in DB, sets `access_token` and `refresh_token` as httpOnly cookies, returns `{ id, username }`
- POST `/api/auth/refresh` → **token rotation**: revokes old refresh token, stores new hash, sets new `access_token` and `refresh_token` cookies
- POST `/api/auth/logout` → revokes the refresh token in DB, clears cookies. Idempotent (succeeds even if token already revoked). Reads refresh token from cookie.

Token cookies: `access_token` and `refresh_token` (httpOnly cookies set by server). JWT algorithm pinned to HS256 with explicit verification.

Validation: username 3–30 chars, alphanumeric + `.` `_` `-` only. Password 8–72 chars (72 is Argon2's input limit). Email optional, max 255 chars, unique if provided. Auth routes are rate-limited via `authLimiter` (default 10 req/15min, cap at 50).

### Refresh Token Architecture

**Table**: `refresh_tokens` — UUID PK, `user_id` FK CASCADE, `token_hash` (64-char SHA-256), `expires_at`, `revoked_at` (nullable). Indexes on `user_id` and `token_hash`.

**Lifecycle**:

- **Signin**: Controller generates refresh token, hashes with SHA-256 (`refresh-tokens.hashToken`), stores hash in DB, sets tokens as httpOnly cookies.
- **Refresh**: Controller finds active token by hash (`findActiveByHash`), revokes old token (`revokeById`), creates new token hash, sets new token cookies via rotation. Prevents reuse — if a revoked token is used again, it's rejected.
- **Logout**: Controller revokes token by ID (`revokeById`), clears cookies. Idempotent — no error if token missing or already revoked.
- **Model functions**: `hashToken`, `create`, `findActiveByHash`, `revokeById`, `revokeAllForUser` (unused), `purgeOld` (unused — no cron job yet).

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

### Invitation System

Invite by username or email, 7-day expiry, accept/decline/revoke flow.

**Token security**: On creation, the invitation token is hashed with SHA-256 (`invitations.hashToken`) and only the hash is stored in `token_hash`. The raw token is returned in the creation response only. All list/get queries use a `SAFE_COLUMNS` array that excludes `token` and `token_hash` to prevent leakage.

**Accept validation**: `POST /api/invitations/:id/accept` requires `{ token: "<64-char-hex>" }` in the request body. The controller hashes the provided token and compares against `token_hash` using `crypto.timingSafeEqual` to prevent timing attacks. Uses `SELECT ... FOR UPDATE` within a transaction to prevent race conditions on acceptance.

**Email invitations**: When inviting by email for a user without an account, `invitee_id` is null. On accept, the controller matches the authenticated user's email against `invitee_email`.

**Project invitations**: Auto-add the user to the parent org as a viewer if not already a member.

### Error Handling

Controllers throw `HttpError(status, message)` → caught by `next(error)` → centralized `errorHandler` logs full context (requestId, stack, IP, userId, method, URL) but only returns `{ message }` to client. Controllers should **not** log errors themselves — the centralized handler is the single logging point. Stack traces are only logged outside production. `notFoundHandler` logs 404s with user-agent tracking.

### Environment Validation

`src/utils/validate-env.js` runs at the very top of `src/index.js`, **before** Express initializes. Validates all required env vars with Joi (`abortEarly: false` to report all errors at once). JWT secrets must be ≥32 characters and must be distinct from each other. `RATE_LIMIT_AUTH_MAX` is capped at 50. Validated values are written back to `process.env`. Fails with `process.exit(1)` — not HttpError (Express doesn't exist yet).

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

## Complete Endpoint Table

### Public (no authentication)

| Method | Path                | Controller                          | Auth                | Rate Limit          |
| ------ | ------------------- | ----------------------------------- | ------------------- | ------------------- |
| GET    | `/health`           | Inline handler                      | No                  | No (before limiter) |
| POST   | `/api/auth/signup`  | `authentication.signup`             | No                  | authLimiter         |
| POST   | `/api/auth/signin`  | `authentication.signin`             | No                  | authLimiter         |
| POST   | `/api/auth/refresh` | `authentication.refreshAccessToken` | requireRefreshToken | authLimiter         |
| POST   | `/api/auth/logout`  | `authentication.logout`             | requireRefreshToken | authLimiter         |

### Authenticated (requireAccessToken)

**User-level (no org context):**

| Method | Path                           | Controller                      | Permission |
| ------ | ------------------------------ | ------------------------------- | ---------- |
| GET    | `/api/invitations`             | `invitations.getMyInvitations`  | —          |
| POST   | `/api/invitations/:id/accept`  | `invitations.acceptInvitation`  | —          |
| POST   | `/api/invitations/:id/decline` | `invitations.declineInvitation` | —          |
| GET    | `/api/permissions`             | `permissions.getPermissions`    | —          |

**Organizations:**

| Method | Path                | Controller                | Permission   |
| ------ | ------------------- | ------------------------- | ------------ |
| POST   | `/api/orgs`         | `organizations.createOrg` | —            |
| GET    | `/api/orgs`         | `organizations.getOrgs`   | —            |
| GET    | `/api/orgs/:org_id` | `organizations.getOrg`    | `org:read`   |
| PUT    | `/api/orgs/:org_id` | `organizations.updateOrg` | `org:update` |
| DELETE | `/api/orgs/:org_id` | `organizations.deleteOrg` | `org:delete` |

**Org Members:**

| Method | Path                                 | Controller                 | Permission           |
| ------ | ------------------------------------ | -------------------------- | -------------------- |
| GET    | `/api/orgs/:org_id/members`          | `members.getMembers`       | `org:read`           |
| PUT    | `/api/orgs/:org_id/members/:user_id` | `members.updateMemberRole` | `org:manage_members` |
| DELETE | `/api/orgs/:org_id/members/:user_id` | `members.removeMember`     | `org:manage_members` |

**Roles:**

| Method | Path                               | Controller         | Permission         |
| ------ | ---------------------------------- | ------------------ | ------------------ |
| POST   | `/api/orgs/:org_id/roles`          | `roles.createRole` | `org:manage_roles` |
| GET    | `/api/orgs/:org_id/roles`          | `roles.getRoles`   | `org:read`         |
| GET    | `/api/orgs/:org_id/roles/:role_id` | `roles.getRole`    | `org:read`         |
| PUT    | `/api/orgs/:org_id/roles/:role_id` | `roles.updateRole` | `org:manage_roles` |
| DELETE | `/api/orgs/:org_id/roles/:role_id` | `roles.deleteRole` | `org:manage_roles` |

**Org Invitations:**

| Method | Path                                           | Controller                        | Permission           |
| ------ | ---------------------------------------------- | --------------------------------- | -------------------- |
| POST   | `/api/orgs/:org_id/invitations`                | `invitations.createOrgInvitation` | `invitations:create` |
| GET    | `/api/orgs/:org_id/invitations`                | `invitations.getOrgInvitations`   | `invitations:manage` |
| DELETE | `/api/orgs/:org_id/invitations/:invitation_id` | `invitations.revokeInvitation`    | `invitations:manage` |

**Projects:**

| Method | Path                                     | Controller               | Permission       |
| ------ | ---------------------------------------- | ------------------------ | ---------------- |
| POST   | `/api/orgs/:org_id/projects`             | `projects.createProject` | `project:create` |
| GET    | `/api/orgs/:org_id/projects`             | `projects.getProjects`   | `project:read`   |
| GET    | `/api/orgs/:org_id/projects/:project_id` | `projects.getProject`    | `project:read`   |
| PUT    | `/api/orgs/:org_id/projects/:project_id` | `projects.updateProject` | `project:update` |
| DELETE | `/api/orgs/:org_id/projects/:project_id` | `projects.deleteProject` | `project:delete` |

**Project Members:**

| Method | Path                                                      | Controller                 | Permission               |
| ------ | --------------------------------------------------------- | -------------------------- | ------------------------ |
| GET    | `/api/orgs/:org_id/projects/:project_id/members`          | `members.getMembers`       | `project:read`           |
| PUT    | `/api/orgs/:org_id/projects/:project_id/members/:user_id` | `members.updateMemberRole` | `project:manage_members` |
| DELETE | `/api/orgs/:org_id/projects/:project_id/members/:user_id` | `members.removeMember`     | `project:manage_members` |

**Project Invitations:**

| Method | Path                                                 | Controller                            | Permission           |
| ------ | ---------------------------------------------------- | ------------------------------------- | -------------------- |
| POST   | `/api/orgs/:org_id/projects/:project_id/invitations` | `invitations.createProjectInvitation` | `invitations:create` |

**Todos:**

| Method | Path                                                    | Controller          | Permission     |
| ------ | ------------------------------------------------------- | ------------------- | -------------- |
| GET    | `/api/orgs/:org_id/projects/:project_id/todos`          | `todos.getTodos`    | `todos:read`   |
| POST   | `/api/orgs/:org_id/projects/:project_id/todos`          | `todos.createTodo`  | `todos:create` |
| DELETE | `/api/orgs/:org_id/projects/:project_id/todos` (bulk)   | `todos.deleteTodos` | `todos:delete` |
| GET    | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | `todos.getTodo`     | `todos:read`   |
| PUT    | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | `todos.updateTodo`  | `todos:update` |
| DELETE | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | `todos.deleteTodo`  | `todos:delete` |

## Model Catalog

| File                 | Exports                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `users.js`           | `create`, `findOne`, `findOneWithPassword`                                                                           |
| `refresh-tokens.js`  | `hashToken`, `create`, `findActiveByHash`, `revokeById`, `revokeAllForUser`, `purgeOld`                              |
| `organizations.js`   | `create`, `findOne`, `findManyByUserId`, `update`, `remove`                                                          |
| `org-members.js`     | `create`, `findOne`, `findManyByOrgId`, `findMemberWithPermissions`, `getPermissions`, `updateRole`, `remove`        |
| `projects.js`        | `create`, `findOne`, `findManyByOrgId`, `findManyByUserId`, `update`, `remove`                                       |
| `project-members.js` | `create`, `findOne`, `findManyByProjectId`, `getPermissions`, `updateRole`, `remove`                                 |
| `roles.js`           | `create`, `findOne`, `findMany`, `update`, `remove`, `findPermissionsByRoleId`, `setPermissions`                     |
| `permissions.js`     | `findAll`, `findOne`, `findByIds`                                                                                    |
| `invitations.js`     | `hashToken`, `create`, `findOne`, `findManyByOrgId`, `findPendingByUserId`, `findPendingByEmail`, `update`, `remove` |
| `todos.js`           | `create`, `findOne`, `findMany`, `findManyPaginated`, `count`, `update`, `remove`, `removeMany`                      |

## Controller Catalog

| File                | Exports                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `authentication.js` | `signup`, `signin`, `refreshAccessToken`, `logout`                                                                                                     |
| `organizations.js`  | `createOrg`, `getOrgs`, `getOrg`, `updateOrg`, `deleteOrg`                                                                                             |
| `projects.js`       | `createProject`, `getProjects`, `getProject`, `updateProject`, `deleteProject`                                                                         |
| `todos.js`          | `requireTodoIdParam` (middleware), `getTodos`, `getTodo`, `createTodo`, `updateTodo`, `deleteTodo`, `deleteTodos`                                      |
| `members.js`        | `getMembers`, `updateMemberRole`, `removeMember`                                                                                                       |
| `roles.js`          | `createRole`, `getRoles`, `getRole`, `updateRole`, `deleteRole`                                                                                        |
| `permissions.js`    | `getPermissions`                                                                                                                                       |
| `invitations.js`    | `createOrgInvitation`, `createProjectInvitation`, `getOrgInvitations`, `getMyInvitations`, `acceptInvitation`, `declineInvitation`, `revokeInvitation` |

## Middleware Catalog

| File                    | Exports                                     |
| ----------------------- | ------------------------------------------- |
| `request-id.js`         | `requestId`                                 |
| `authorization.js`      | `requireAccessToken`, `requireRefreshToken` |
| `resolve-org.js`        | `resolveOrg`                                |
| `resolve-project.js`    | `resolveProject`                            |
| `require-permission.js` | `requirePermission`                         |
| `rate-limit.js`         | `authLimiter`, `generalLimiter`             |
| `logger.js`             | `httpLogger`, `requestLogger`               |
| `error.js`              | `errorHandler`, `notFoundHandler`           |

**Note**: `cookie-parser` is also loaded as middleware (NPM package, not a custom file) to populate `req.cookies` for reading auth tokens from httpOnly cookies.

## Utility Catalog

| File              | Exports                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `argon2.js`       | `hashPassword`, `verifyPassword`                                                         |
| `jwt.js`          | `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`, `verifyRefreshToken` |
| `http-error.js`   | `HttpError` (default)                                                                    |
| `response.js`     | `apiResponse` (default)                                                                  |
| `pagination.js`   | `validatePaginationQuery`, `buildPaginationMeta`, `executePaginatedQuery`                |
| `sanitize.js`     | `escapeIlike`                                                                            |
| `constant.js`     | `HTTP_STATUS_CODE`, `HTTP_STATUS_MESSAGE`                                                |
| `logger.js`       | `logger` (default, Winston instance)                                                     |
| `validate-env.js` | `validateEnv` (default)                                                                  |

## Code Style

- **Formatter**: Prettier — no semicolons, 2-space indent, 100 char width
- **Linter**: Oxlint — correctness (error), suspicious (warn)
- **File naming**: kebab-case (`http-error.js`, `validate-env.js`)
- **UUIDs**: Use `crypto.randomUUID()` from `node:crypto` (not uuid package)
- **Imports**: ES modules only. Models use named exports. Controllers imported as namespace (`import * as controller`)
- **Responses**: Always use `apiResponse({ message, data, pagination })` from `src/utils/response.js`. Pass resource directly as `data` (object for single, array for list, `null` for delete/error). For paginated lists, pass the array as `data` and metadata as `pagination`.

## Environment Variables

Required: `DATABASE_URL`, `ACCESS_TOKEN_SECRET` (≥32 chars), `REFRESH_TOKEN_SECRET` (≥32 chars, must differ from ACCESS_TOKEN_SECRET), `JWT_ISSUER`, `JWT_AUDIENCE`

Optional with defaults: `NODE_ENV` (development), `PORT` (3000), `ACCESS_TOKEN_EXPIRES_IN` (15m), `REFRESH_TOKEN_EXPIRES_IN` (7d), `LOG_LEVEL` (info), `LOG_TO_FILE` (true), `CORS_ALLOWED_ORIGINS` (http://localhost:8080), `RATE_LIMIT_AUTH_MAX` (10, capped at 50), `RATE_LIMIT_GENERAL_MAX` (100)

## Database

- **Config**: `knexfile.js` — connection pool min 2, max 10
- **Migrations**: `database/migrations/` — format `YYYYMMDDHHMMSS_name.js`
  - 11 migration files: users, organizations, permissions, roles, role_permissions, org_members, projects, project_members, invitations, todos, refresh_tokens
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
- **Database**: Real PostgreSQL test database (configured in `.env.test`)
- **Config**: `vitest.config.js` — `fileParallelism: false` (integration tests share DB state)
- **Setup**: `tests/global-setup.js` — loads `.env.test`, validates env, runs migrations, truncates all tables, seeds permissions; returns teardown function
- **Helpers**: `tests/helpers.js`:
  - `getApp()`, `request()` — app bootstrapping
  - `createTestUser()`, `getAuthCookies()` — authentication (returns Cookie header from httpOnly cookie-based signin)
  - `createTestOrg()` — creates org with system roles, adds creator as owner
  - `createTestProject()` — creates project within org, adds creator as member
  - `addOrgMember()`, `addProjectMember()` — membership setup
  - `cleanAllTables()` — truncates all tables except permissions
  - `seedPermissions()` — seeds 16 system permissions (called once in global setup)
- **Structure**: `tests/unit/` for pure logic, `tests/integration/` for HTTP endpoints
- **Coverage**:
  - Unit: `http-error.test.js`, `pagination.test.js`, `sanitize.test.js`
  - Integration: `health.test.js`, `auth.test.js`, `todos.test.js`, `organizations.test.js`, `permissions.test.js`, `invitations.test.js`
  - Not tested: projects CRUD, roles CRUD, member management, rate limiting, middleware unit tests
- **Convention**: Each integration test file calls `cleanAllTables()` in `beforeEach` or `afterEach`. Permissions persist across tests (seeded once in global setup).
