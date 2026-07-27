# NestJS API Template

A production-ready RESTful API template built with NestJS 11, featuring PostgreSQL via Prisma, JWT authentication over httpOnly cookies, and a multi-tenant architecture with organization-based access control. Designed to jumpstart your next Node.js API project.

## Monorepo Usage

This package lives at `apps/api` inside the monorepo.

From the repository root, run:

```bash
corepack pnpm dev:api
corepack pnpm build:api
corepack pnpm lint:api
corepack pnpm test:api
```

You can still run package-local commands from `apps/api` with `corepack pnpm`.

## Features

### Authentication & Security

- **JWT Authentication**: Dual-token system with access tokens (15min) and refresh tokens (7 days), pinned to HS256, delivered as httpOnly cookies
- **Password Hashing**: Argon2 for secure password storage
- **Password Complexity**: Requires uppercase, lowercase, digit, and special character
- **Account Lockout**: 5 failed login attempts locks the account for 15 minutes
- **Password Reset**: Token-based `forgot-password` / `reset-password` pair. The token is a 64-hex secret stored only as a SHA-256 hash, valid for 1 hour and single-use; `forgot-password` responds identically for known and unknown addresses (no account enumeration), and a successful reset clears the lockout counters and revokes every outstanding refresh token. Delivery is a documented seam (`PasswordResetNotifierService`) — the template ships no mail provider.
- **Refresh Token Reuse Detection**: Refresh tokens rotate on every use. Presenting an already-revoked token revokes **all** of that user's refresh tokens, clears the cookies, and logs a warning — a replayed token cannot be used to keep a stolen session alive.
- **Security Headers**: Helmet with strict Content Security Policy, referrer protection, and HSTS (1-year max-age with preload)
- **CORS**: Configurable allowed origins with credentials support for cookie-based auth
- **Rate Limiting**: `@nestjs/throttler` with a `general` limiter (`RATE_LIMIT_GENERAL_MAX`, 15-minute window) wired through `ThrottlerModule.forRootAsync`, plus a stricter class-level `@Throttle` override on the auth controller (`RATE_LIMIT_AUTH_MAX`). The health routes are exempt. Counters live in **Redis** (`@nest-lab/throttler-storage-redis`), so limits are shared across every API instance rather than counted per process.
- **Input Validation**: `class-validator` DTOs with a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); ILIKE wildcard sanitization on search
- **Environment Validation**: Startup checks (Joi) for required variables, secret strength, and placeholder detection — fail-fast before boot
- **Body Size Limits**: 100kb cap on JSON and URL-encoded payloads
- **Request ID Validation**: Incoming `X-Request-Id` headers are shape-checked against a dashed UUID or 32 undashed hex characters (nginx's `$request_id`); anything else is silently replaced with a freshly generated UUID, so nothing unvalidated reaches the log stream
- **Pagination & Search**: Reusable list DTO (page, limit, sort, search) with case-insensitive, sanitized search

### Multi-Tenant Architecture

- **Organization hierarchy**: Organization → Project → Todos with shared database tenant isolation via `org_id` and `project_id` columns
- **Flexible membership**: Users can belong to multiple organizations and multiple projects (GitHub-style model)
- **Custom RBAC**: 4 built-in system roles (owner, admin, member, viewer) plus custom roles with granular permission assignment
- **17 system permissions**: covering org management, project management, invitation management, and todo operations. Cross-project visibility is granted by the `project:read_all` permission, not by a hard-coded role name, so a custom role can be given org-wide project visibility.
- **Invitation system**: Invite by email, 7-day token expiry, accept/decline/revoke/resend flow; project invitations auto-add the invitee to the parent org as a viewer. A second pending invitation for the same email in the same scope is rejected with 400. Unregistered addresses can be invited — a public, token-gated preview endpoint lets a logged-out invitee see the invitation, and signup backfills the link between the new account and any invitations already waiting for its email. Accepting is authenticated **and** requires the raw token in the request body (`{ token: "<64 hex chars>" }`), so being logged in is not by itself enough. Email delivery is a single documented seam (`InvitationNotifierService`); the template ships no mail provider.

### Database & Architecture

- **PostgreSQL**: Robust relational database (12 domain models)
- **Prisma**: Type-safe ORM and migration engine; the schema is snake_case in the DB (`@map`/`@@map`) and camelCase in the client
- **Modular NestJS layout**: `src/` splits four ways — `core/` (infrastructure), `shared/` (stateless helpers), `modules/<feature>/` (one self-contained feature module each: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/`), and `tenancy/` (the org/project guards). Services hold business logic and talk to Prisma, controllers stay thin. The layering rule is in [`AGENTS.md`](AGENTS.md#source-layout)
- **Shared response contracts**: `@fullstack/contracts` (`packages/contracts`) is a dependency-free, type-only package; the API's response classes `implements` its interfaces so a drift between contract and payload is a compile error
- **TypeScript**: Compiled to CommonJS (`nest build` → `dist/`)

### Observability & Reliability

- **Request ID Tracking**: Automatic `X-Request-Id` correlation across logs and responses (accepts a dashed UUID or 32 hex characters, otherwise generates one) and exposed to browser JS via `Access-Control-Expose-Headers`
- **Health Checks**: Separate liveness and readiness probes plus the combined legacy endpoint — `GET /health/live` (process only, never touches the database), `GET /health/ready` (database probe, 503 when unreachable), and `GET /health`. All three sit outside the `/api/v1` prefix, are public, and are exempt from rate limiting. `/health/ready` and `/health` report uptime and database details outside production and omit them in production; `/health/live` returns a fixed payload in every environment
- **Logging**: Structured JSON logging via `nestjs-pino` (`pino-http`) with request IDs in every log entry; `pino-pretty` in non-production. Cookies, `Authorization`, and `Set-Cookie` are stripped from log records so no token material is ever written
- **Scheduled Cleanup**: A `@nestjs/schedule` cron job (`CleanupService`, daily at 03:00) prunes refresh tokens that expired or were revoked more than 7 days ago, password-reset tokens expired more than 7 days ago, and invitations expired more than 30 days ago. Retention is measured from `expires_at`/`revoked_at`, never `created_at`, so a still-valid long-lived token is never deleted. It takes a non-blocking PostgreSQL advisory lock (`pg_try_advisory_xact_lock`) so exactly one replica does the work, and can be turned off with `CLEANUP_ENABLED=false`
- **Background Jobs**: A BullMQ queue on Redis (`src/core/queue/`) carries notification delivery. `InvitationNotifierService` and `PasswordResetNotifierService` enqueue a job instead of sending inline, so a slow or failing mail provider cannot stretch or fail the HTTP request that triggered it. Redis is therefore a hard requirement in every environment — BullMQ ships no in-memory driver

### Developer Experience

- **Standardized Responses**: Consistent success/error envelope via a global interceptor and exception filter
- **Error Handling**: Global `AllExceptionsFilter` normalizes every error into `{ message, data: null, request_id }`
- **OpenAPI / Swagger UI**: The spec is generated from the controllers and DTOs at boot by `@nestjs/swagger` and served at `/api/docs` — no hand-maintained schema file to drift. On by default outside production, controlled by `SWAGGER_ENABLED`
- **Testing**: Jest + Supertest e2e suite booting the real app against a real PostgreSQL test database (no mocks)
- **Environment Config**: dotenv for environment-specific settings, validated at startup
- **Code Quality**: Oxlint for fast linting, Prettier for consistent formatting

## Tech Stack

| Component          | Version                                | Description                        |
| ------------------ | -------------------------------------- | ---------------------------------- |
| **Runtime**        | Node.js >=24.0.0                       | JavaScript runtime                 |
| **Framework**      | NestJS ^11.1.28                        | Progressive Node.js framework      |
| **HTTP Platform**  | Express ^5.2.1                         | Underlying HTTP adapter            |
| **Database**       | PostgreSQL                             | Relational database                |
| **ORM**            | Prisma ^6.19.3                         | Type-safe ORM & migrations         |
| **Cache / Queue**  | Redis, ioredis ^5.11.1                 | Queue backend & throttler store    |
| **Job Queue**      | BullMQ ^5.81.2, @nestjs/bullmq ^11.0.4 | Asynchronous notification delivery |
| **Authentication** | @nestjs/jwt ^11.0.2, Argon2 ^0.45.1    | Token-based auth & hashing         |
| **Cookies**        | cookie-parser ^1.4.7                   | httpOnly cookie management         |
| **Validation**     | class-validator ^0.15.1, Joi ^18.2.3   | DTO validation & env checks        |
| **Security**       | Helmet ^8.3.0                          | Security middleware                |
| **Rate Limiting**  | @nestjs/throttler ^6.5.0               | Request throttling                 |
| **Scheduling**     | @nestjs/schedule ^6.1.3                | Cron-based maintenance jobs        |
| **API Docs**       | @nestjs/swagger ^11.4.6                | OpenAPI spec & Swagger UI          |
| **Logging**        | nestjs-pino ^4.6.1, pino-http ^11.0.0  | Structured logging                 |
| **Testing**        | Jest ^30.4.2, Supertest ^7.2.2         | Test runner & HTTP testing         |
| **Code Quality**   | Oxlint ^1.75.0, Prettier ^3.9.6        | Linting and formatting             |

## Prerequisites

- **Node.js** v24 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** database server ([Download](https://www.postgresql.org/download/))
- **Redis** server ([Download](https://redis.io/downloads/)) — required, not optional; see `REDIS_URL` under [Configuration](#configuration)
- **Git** for cloning the repository

Node 24 is a hard floor: `prisma.config.ts` runs the database seed as `node prisma/seed.ts`, relying on Node's native TypeScript type-stripping — no ts-node/tsx is installed, and Node ≤ 22 fails there with a confusing syntax error.

## Quick Start

```bash
# 1. Install dependencies
corepack pnpm install

# 2. Create environment file
cp .env.example .env
# Edit .env with your database credentials and secrets

# 3. Set up the database
corepack pnpm db:migrate       # prisma migrate deploy
corepack pnpm db:seed          # prisma db seed — 17 canonical permissions (idempotent)

# 4. Start development server
corepack pnpm dev
```

The API will be available at `http://localhost:3000/api/v1` (health probes at `http://localhost:3000/health`).

## Configuration

This table is the canonical environment reference for the monorepo. The root `README.md` lists only the variables required to boot and links here; `AGENTS.md` does not restate it. Validation lives in `src/core/config/env.validation.ts` and runs at startup with `abortEarly: false`, so a bad `.env` fails fast with every problem listed at once.

Create a `.env` file in the project root with the following variables:

| Variable                   | Description                                                                     | Default                            | Required |
| -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| `NODE_ENV`                 | Environment mode — one of `development`, `production`, `test`                   | `development`                      | No       |
| `PORT`                     | Server port — integer, 1–65535                                                  | `3000`                             | No       |
| `DATABASE_URL`             | PostgreSQL connection string — URI with scheme `postgresql://` or `postgres://` | -                                  | Yes      |
| `REDIS_URL`                | Redis connection string — URI with scheme `redis://` or `rediss://`             | -                                  | Yes      |
| `ACCESS_TOKEN_SECRET`      | Secret for access tokens                                                        | -                                  | Yes      |
| `ACCESS_TOKEN_EXPIRES_IN`  | Access token lifetime                                                           | `15m`                              | No       |
| `REFRESH_TOKEN_SECRET`     | Secret for refresh tokens                                                       | -                                  | Yes      |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime                                                          | `7d`                               | No       |
| `JWT_ISSUER`               | JWT issuer claim (iss)                                                          | -                                  | Yes      |
| `JWT_AUDIENCE`             | JWT audience claim (aud)                                                        | -                                  | Yes      |
| `LOG_LEVEL`                | Logging level                                                                   | `info`                             | No       |
| `CLEANUP_ENABLED`          | Run the nightly cleanup cron job                                                | `true`                             | No       |
| `SWAGGER_ENABLED`          | Serve Swagger UI at `/api/docs`                                                 | `false` in production, else `true` | No       |
| `CORS_ALLOWED_ORIGINS`     | Comma-separated allowed origins                                                 | `http://localhost:8080`            | No       |
| `APP_BASE_URL`             | Public SPA origin for invite links                                              | `http://localhost:8080`            | No\*     |
| `RATE_LIMIT_AUTH_MAX`      | Auth endpoint rate limit (per 15min)                                            | `10` (max 50)                      | No       |
| `RATE_LIMIT_GENERAL_MAX`   | Global rate limit (per 15min, shared across instances) — integer ≥ 1            | `1000`                             | No       |

`REDIS_URL` is required in every environment and has **no default** — Redis backs the job queue, and BullMQ ships no in-memory driver, so an optional Redis with a fallback would mean jobs are accepted and never run while `/health/ready` still reports healthy. Local development uses `redis://localhost:6379`. The local Docker stack ships a `redis` service, so inside that container the host must be the compose service name (`redis://redis:6379`) — `localhost` there is the API process itself. The production stack ships no Redis container: point `REDIS_URL` at a managed instance (`rediss://` for TLS), the same way `DATABASE_URL` points at a managed PostgreSQL. `.env.test` deliberately points at **database 1** (`redis://localhost:6379/1`) so the test suite's writes and flushes cannot evict whatever local development is keeping on db 0.

Both token lifetimes must match the grammar `<number><s|m|h|d>` (e.g. `15m`, `7d`) — the same string drives the JWT expiry, the `refresh_tokens` row, and the cookie `maxAge`, so broader formats such as `1w` are deliberately rejected. Boolean-style variables (`CLEANUP_ENABLED`, `SWAGGER_ENABLED`) accept the literal strings `"true"` or `"false"`.

\* `APP_BASE_URL` has a default, but the default is only correct for local development. It is the base of every invitation accept link (`<APP_BASE_URL>/invite/:invitation_id?token=…`), so leaving it unset in production produces links pointing at `localhost`. Set it to `https://app.<DOMAIN>` in production and `http://localhost` for the local Docker stack.

**Example DATABASE_URL:**

```
postgresql://username:password@localhost:5432/database_name
```

**Security Note:** JWT secrets must be at least 32 characters, must differ from each other, and must not contain placeholder values like "changeme". The server validates all required environment variables at startup and will refuse to start with missing, weak, or placeholder secrets. Generate secrets with:

```bash
openssl rand -hex 32
```

## Logging

This template uses `nestjs-pino` (`pino-http`) for structured, low-overhead logging:

### Features

- **Structured Logging**: JSON-formatted logs for easy parsing and analysis
- **Request Correlation**: Every log line carries the request ID derived from `X-Request-Id` (or a generated UUID)
- **Pretty Output in Dev**: `pino-pretty` formats logs for readability outside production
- **Redaction**: `req.headers.cookie`, `req.headers.authorization`, and `res.headers["set-cookie"]` are removed from every log record
- **Log Levels**: `error`, `warn`, `info`, `debug` — env validation rejects anything else, so pino's `trace` and `fatal` are not accepted here

### Log Levels

Set the `LOG_LEVEL` environment variable to control logging verbosity:

| Level   | Description                        |
| ------- | ---------------------------------- |
| `error` | Error messages only                |
| `warn`  | Warnings and errors                |
| `info`  | Informational messages (default)   |
| `debug` | Debug information (verbose output) |

## Pagination & Search

List endpoints accept a list DTO (e.g. `ListTodosDto` under `src/modules/todos/dto/`) with `page`, `limit`, `sort_by`, `sort_order`, and `search`. Services return `{ data, pagination }`, which the controller passes straight into the response envelope.

Not every list is paginated, on purpose: roles, orgs, projects, and `GET /api/v1/invitations` (your own pending invitations) return unbounded lists because they are naturally small per tenant, while org/project member and org invitation lists **are** paginated. Two documented scale ceilings — not shipped features: offset pagination degrades on deep pages (keyset/cursor pagination is the scale-up path), and `ILIKE` search will need a `pg_trgm` index once todo tables grow large.

### Query Parameters

| Parameter    | Type    | Default      | Description                                                                                                                                         |
| ------------ | ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`       | integer | `1`          | Page number (1-indexed)                                                                                                                             |
| `limit`      | integer | `10` or `50` | Items per page, max 100. `PaginationQueryDto` (todos) defaults to 10; `ListQueryDto` (org members, project members, org invitations) defaults to 50 |
| `sort_by`    | string  | per resource | No DTO-level default; each service picks its own (todos resolves to `updated_at`)                                                                   |
| `sort_order` | string  | `desc`       | Sort direction (`asc` or `desc`)                                                                                                                    |
| `search`     | string  | `""`         | Case-insensitive search term (max 255 chars)                                                                                                        |

`sort_by`, `sort_order`, and `search` are only honoured by the todos list. The member and org-invitation lists take `ListQueryDto` for `page`/`limit` but sort on a fixed, deterministic column (`joined_at asc` for members, `created_at desc` for invitations) and do not filter on `search`. Todos narrows `sort_by` further with its own `ListTodosDto`, which accepts only `updated_at` or `title`.

### Example Request

```
GET /api/v1/orgs/:org_id/projects/:project_id/todos?page=1&limit=20&sort_by=title&sort_order=asc&search=groceries
```

### Response Format

```json
{
  "message": "OK",
  "data": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100,
    "items_per_page": 20,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  }
}
```

Every success response is `{ message, data }`, with `pagination` added on paginated lists. Errors
use `{ message, data: null, request_id }` — `request_id` appears on errors only, so a failure can
always be correlated to a log line. How the interceptor and the exception filter produce these
shapes, including the status mapping and the flattening of validation errors, is documented in
[`AGENTS.md`](AGENTS.md#response-envelope).

## Development Commands

### Server

```bash
corepack pnpm dev          # nest start --watch (dev server)
corepack pnpm start        # node dist/main (production runtime)
corepack pnpm build        # nest build → dist/
```

### Testing

```bash
corepack pnpm test              # Integration + e2e tier (real PostgreSQL and Redis, .env.test)
corepack pnpm test:unit         # Pure-unit specs only — no database, no Redis, runs in seconds
corepack pnpm test:watch        # Jest in watch mode
corepack pnpm test:cov          # Jest with coverage report
```

Specs are sorted into three tiers **by filename suffix**, and the two Jest configs select on that
suffix alone. There is no hand-maintained exclusion list; `testPathIgnorePatterns` was removed once
the suffixes carried the distinction.

| Tier        | Suffix         | Config                | Selected by `testRegex`         | Needs              |
| ----------- | -------------- | --------------------- | ------------------------------- | ------------------ |
| Unit        | `.spec.ts`     | `test/jest-unit.json` | `\.spec\.ts$`                   | nothing external   |
| Integration | `.int-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |
| End-to-end  | `.e2e-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |

Because `.int-spec.ts` and `.e2e-spec.ts` do **not** end in `.spec.ts`, the two configs select
disjoint sets — the same file is never run twice, and the two tiers' counts may be added. Renaming a
spec moves it between tiers with no config edit, which is the point; it also means a typo in the
suffix silently drops a file from both tiers.

Tests use a real PostgreSQL test database **and a real Redis** configured in `.env.test` — create it
with `cp .env.test.example .env.test` and adjust `DATABASE_URL` / `REDIS_URL`. Two different reset
mechanisms apply, and the asymmetry is deliberate:

- **PostgreSQL has no automatic per-test reset.** `test/setup-e2e.ts` is a Jest `globalSetup` that
  applies migrations and seeds the canonical permissions **once per run**. It exports `truncateAll`,
  but nothing calls it automatically — each spec invokes it itself, so a spec that omits the call
  leaks rows into the next one.
- **Redis _is_ reset before every test.** `test/reset-redis-state.ts` is registered as
  `setupFilesAfterEnv`, so its `beforeEach` is a root hook covering every test in every suite in the
  tier. It calls `flushRedis`, which issues `flushdb` (not `flushall`); `.env.test` pins the
  connection to **database 1**, so the blast radius is exactly the data the run owns. This exists
  because throttle counters and BullMQ job hashes are now process-external and would otherwise carry
  across suites — a full e2e pass signs in far more than the Joi-capped `RATE_LIMIT_AUTH_MAX`.

Every module has an e2e spec — auth (including account lockout, cookie-based auth, token rotation,
and password reset), health (live/ready), orgs, roles, members, projects, todos, permissions,
invitations, throttler storage, Redis isolation, and the generated OpenAPI document.

### Linting & Formatting

```bash
corepack pnpm lint             # Run Oxlint (linter)
corepack pnpm lint:fix         # Auto-fix issues with Oxlint
corepack pnpm format           # Apply formatting with Prettier
```

**Note**: Run `corepack pnpm lint:fix` and `corepack pnpm format` before committing.

### Database (Prisma)

```bash
corepack pnpm db:migrate        # prisma migrate deploy (apply pending migrations)
corepack pnpm migrate:dev       # prisma migrate dev (create a new migration in dev)
corepack pnpm db:seed           # prisma db seed (17 canonical permissions, idempotent)
corepack pnpm db:generate       # prisma generate (regenerate the client after schema edits)
corepack pnpm prisma:pull       # prisma db pull (introspect the DB into schema.prisma)
```

Migrations never run automatically — apply them explicitly on every environment. The seed idempotently upserts the 17 canonical permissions; it does not populate demo data.

## API Documentation

### OpenAPI / Swagger UI

The OpenAPI document is generated at boot from the controllers and DTOs by `@nestjs/swagger`, so it cannot drift from the code the way a hand-maintained `openapi.json` did. Browse it at:

```
http://localhost:3000/api/docs
```

- **Enabled by**: `SWAGGER_ENABLED` — defaults to `true` outside production and `false` when `NODE_ENV=production`. The check is fail-closed (`=== "true"`), so an unset or malformed value in production leaves the spec unpublished.
- **Route metadata** comes from the Nest decorators; DTO property types, optionality, and validation come from the `@nestjs/swagger` CLI plugin configured in `nest-cli.json` (`introspectComments: true`, `dtoFileNameSuffix: [".dto.ts", ".response.ts"]`), so plain DTOs and response classes alike need no `@ApiProperty()` boilerplate.
- **Auth** is declared as the `access_token` cookie (`addCookieAuth`), not a bearer header — "Try it out" works from a browser session that has already signed in.
- **Paths** carry the `/api/v1` prefix because the document is built after `setGlobalPrefix` and `enableVersioning`, matching what clients actually call. The three health probes appear unversioned, as they are.
- **The docs route itself is not versioned.** Swagger UI is mounted at `api/docs` directly on the Express instance, so it is unaffected by `enableVersioning` and there is no `/api/v1/docs`.
- **Response classes need `extraModels`.** Generic interfaces erase at runtime, so a response class only reaches `components.schemas` if it is listed in the `extraModels` array passed to `SwaggerModule.createDocument` in `configureApp`. Adding a response class without adding it there produces a document that silently omits its schema.

Set `SWAGGER_ENABLED=true` explicitly if you want the spec exposed on a production deployment.

## API Endpoints

This section is the canonical route list for the monorepo — the root `README.md` and
`AGENTS.md` link here instead of restating it. The **Permission** column is the name checked by
`PermissionsGuard` (`@RequirePermission`, usually supplied by `@OrgScoped`/`@ProjectScoped`); `—`
means the route has no permission gate beyond authentication. Tables without an **Auth Required**
column are entirely `access_token`-authenticated; where the column is present, it is authoritative.
Why the guards run in that order, and why health sits outside the `/api` prefix, is explained in
[`AGENTS.md`](AGENTS.md#endpoints).

### Health Check

Health routes live outside the `/api` prefix, are public, and skip the rate limiter.

| Method | Endpoint        | Description                                                     | Auth Required |
| ------ | --------------- | --------------------------------------------------------------- | ------------- |
| GET    | `/health/live`  | Liveness — process only, never touches the database; always 200 | No            |
| GET    | `/health/ready` | Readiness — database probe; 200 when reachable, 503 when not    | No            |
| GET    | `/health`       | Combined check with database connectivity; 200 healthy, 503 not | No            |

`/health/live` deliberately ignores the database: an unreachable database is a reason to stop routing traffic to an instance, not a reason for the orchestrator to restart it. The container healthchecks in both compose files probe `http://localhost:3000/health/live` from **inside** the `api` container, so they never traverse nginx.

**Reachability through the production edge:** `nginx/templates/api.conf.template` exposes health with `location = /health` — an exact match — so only `https://api.<DOMAIN>/health` is reachable from outside. `/health/live` and `/health/ready` fall through to `location /`, whose `proxy_pass http://api:3000/api/` turns them into `/api/health/live` and `/api/health/ready` — paths that exist under neither the version prefix nor the prefix exclusion, so they 404. Point external uptime monitors at `/health`, or widen that `location` to a prefix match (`location /health`) if you want the split probes published. The local stack (`nginx/local.conf`) already uses a prefix match, so all three work there.

### Authentication Endpoints

| Method | Endpoint                       | Description                                         | Auth Required |
| ------ | ------------------------------ | --------------------------------------------------- | ------------- |
| POST   | `/api/v1/auth/signup`          | Create new user account                             | No            |
| POST   | `/api/v1/auth/signin`          | Sign in; server sets httpOnly auth cookies          | No            |
| GET    | `/api/v1/auth/me`              | Verify cookie validity, return user                 | Access Token  |
| POST   | `/api/v1/auth/refresh`         | Rotate tokens via httpOnly cookie                   | Refresh Token |
| POST   | `/api/v1/auth/logout`          | Revoke refresh token, clear cookies                 | Refresh Token |
| POST   | `/api/v1/auth/forgot-password` | Request a reset link — always 200, never enumerates | No            |
| POST   | `/api/v1/auth/reset-password`  | Consume a reset token and set a new password        | No            |

`forgot-password` takes `{ email }` and answers `200` whether or not an account exists. `reset-password` takes `{ token, password, confirmation_password }`, where `token` is the 64-hex value from the reset link; it is single-use, expires after 1 hour, and a successful reset revokes every outstanding refresh token for that user.

### Organization Endpoints

| Method | Endpoint               | Description      | Permission   |
| ------ | ---------------------- | ---------------- | ------------ |
| POST   | `/api/v1/orgs`         | Create org       | —            |
| GET    | `/api/v1/orgs`         | List user's orgs | —            |
| GET    | `/api/v1/orgs/:org_id` | Get org details  | `org:read`   |
| PUT    | `/api/v1/orgs/:org_id` | Update org       | `org:update` |
| DELETE | `/api/v1/orgs/:org_id` | Delete org       | `org:delete` |

### Project Endpoints (nested under org)

| Method | Endpoint                                    | Description    | Permission                                                                            |
| ------ | ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| POST   | `/api/v1/orgs/:org_id/projects`             | Create project | `project:create`                                                                      |
| GET    | `/api/v1/orgs/:org_id/projects`             | List projects  | `project:read` (returns all org projects when the caller also has `project:read_all`) |
| GET    | `/api/v1/orgs/:org_id/projects/:project_id` | Get project    | `project:read`                                                                        |
| PUT    | `/api/v1/orgs/:org_id/projects/:project_id` | Update project | `project:update`                                                                      |
| DELETE | `/api/v1/orgs/:org_id/projects/:project_id` | Delete project | `project:delete`                                                                      |

### Todo Endpoints (nested under project)

| Method | Endpoint                                                   | Description                        | Permission     |
| ------ | ---------------------------------------------------------- | ---------------------------------- | -------------- |
| POST   | `/api/v1/orgs/:org_id/projects/:project_id/todos`          | Create todo                        | `todos:create` |
| GET    | `/api/v1/orgs/:org_id/projects/:project_id/todos`          | List todos (paginated, searchable) | `todos:read`   |
| GET    | `/api/v1/orgs/:org_id/projects/:project_id/todos/:todo_id` | Get todo                           | `todos:read`   |
| PUT    | `/api/v1/orgs/:org_id/projects/:project_id/todos/:todo_id` | Update todo                        | `todos:update` |
| DELETE | `/api/v1/orgs/:org_id/projects/:project_id/todos/:todo_id` | Delete todo                        | `todos:delete` |
| DELETE | `/api/v1/orgs/:org_id/projects/:project_id/todos?ids=...`  | Bulk delete todos                  | `todos:delete` |

### Role Endpoints (nested under org)

Create and update bodies take `permission_ids: string[]`.

| Method | Endpoint                              | Description        | Permission         |
| ------ | ------------------------------------- | ------------------ | ------------------ |
| POST   | `/api/v1/orgs/:org_id/roles`          | Create custom role | `org:manage_roles` |
| GET    | `/api/v1/orgs/:org_id/roles`          | List roles         | `org:read`         |
| GET    | `/api/v1/orgs/:org_id/roles/:role_id` | Get role details   | `org:read`         |
| PUT    | `/api/v1/orgs/:org_id/roles/:role_id` | Update role        | `org:manage_roles` |
| DELETE | `/api/v1/orgs/:org_id/roles/:role_id` | Delete custom role | `org:manage_roles` |

### Organization Member Endpoints

| Method | Endpoint                                | Description        | Permission           |
| ------ | --------------------------------------- | ------------------ | -------------------- |
| GET    | `/api/v1/orgs/:org_id/members`          | List org members   | `org:read`           |
| PUT    | `/api/v1/orgs/:org_id/members/:user_id` | Update member role | `org:manage_members` |
| DELETE | `/api/v1/orgs/:org_id/members/:user_id` | Remove member      | `org:manage_members` |

### Project Member Endpoints

| Method | Endpoint                                                     | Description          | Permission               |
| ------ | ------------------------------------------------------------ | -------------------- | ------------------------ |
| GET    | `/api/v1/orgs/:org_id/projects/:project_id/members`          | List project members | `project:read`           |
| PUT    | `/api/v1/orgs/:org_id/projects/:project_id/members/:user_id` | Update member role   | `project:manage_members` |
| DELETE | `/api/v1/orgs/:org_id/projects/:project_id/members/:user_id` | Remove member        | `project:manage_members` |

### Invitation Endpoints

| Method | Endpoint                                                 | Description                          | Auth Required       | Permission           |
| ------ | -------------------------------------------------------- | ------------------------------------ | ------------------- | -------------------- |
| POST   | `/api/v1/orgs/:org_id/invitations`                       | Create org invitation                | Access Token        | `invitations:create` |
| GET    | `/api/v1/orgs/:org_id/invitations`                       | List org invitations                 | Access Token        | `invitations:manage` |
| DELETE | `/api/v1/orgs/:org_id/invitations/:invitation_id`        | Revoke invitation                    | Access Token        | `invitations:manage` |
| POST   | `/api/v1/orgs/:org_id/invitations/:invitation_id/resend` | Reissue invitation (new token/link)  | Access Token        | `invitations:manage` |
| POST   | `/api/v1/orgs/:org_id/projects/:project_id/invitations`  | Create project invitation            | Access Token        | `invitations:create` |
| GET    | `/api/v1/invitations`                                    | List my pending invitations          | Access Token        | —                    |
| GET    | `/api/v1/invitations/:invitation_id/preview?token=…`     | Preview an invitation (public)       | No — token in query | —                    |
| POST   | `/api/v1/invitations/:invitation_id/accept`              | Accept invitation — body `{ token }` | Access Token        | —                    |
| POST   | `/api/v1/invitations/:invitation_id/decline`             | Decline invitation                   | Access Token        | —                    |

### Permissions Endpoint

| Method | Endpoint              | Description                 | Auth Required | Permission |
| ------ | --------------------- | --------------------------- | ------------- | ---------- |
| GET    | `/api/v1/permissions` | List all system permissions | Access Token  | —          |

### Authentication Format

Authentication uses **httpOnly cookies** set by the server. Tokens are never exposed to client-side JavaScript.

- **Signin**: Server sets `access_token` (httpOnly, path `/api/v1`) and `refresh_token` (httpOnly, path `/api/v1/auth`) cookies — the two paths come from `ACCESS_COOKIE_PATH` / `REFRESH_COOKIE_PATH` in `src/core/config/api-version.ts`, never spelled by hand. Each cookie's `maxAge` is derived from `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` (defaults `15m` / `7d`), so the cookie and the JWT can never disagree about lifetime. The response body returns `{ id, name, email }` only — no tokens.
- **Token refresh**: The browser automatically sends the `refresh_token` cookie. Server rotates both tokens and sets new cookies. Response body is `{ data: null }`. Replaying an already-revoked refresh token revokes every refresh token for that user and clears the cookies.
- **Authenticated requests**: The browser automatically sends the `access_token` cookie with every request under `/api/v1`.
- **Logout**: Server revokes the refresh token and clears both cookies.

**Cookie properties**: `httpOnly`, `Secure` (production only), `SameSite=Strict`, scoped to appropriate paths.

**Cookie paths match by whole path segments**, so `/api/auth` does not cover `/api/v1/auth/refresh`. Bumping `API_VERSION` without moving the cookie paths with it logs every user out at their next refresh, with no error raised anywhere. Behind the production edge the same paths are rewritten a second time by nginx (`proxy_cookie_path /api/v1/auth /v1/auth`, then `/api/v1 /v1`), which cannot import the TypeScript constants — so `src/core/config/api-version.ts` and `nginx/templates/api.conf.template` must be changed together.

## System Roles & Permissions

There are 4 built-in system roles per organization — `owner`, `admin`, `member`, `viewer` — and
custom roles can be created with any combination of the 17 system permissions. Which permission
each role holds is documented in [`AGENTS.md`](AGENTS.md#permissions), derived from
`src/modules/orgs/system-roles.ts` and seeded (with descriptions) by `prisma/seed.ts`. Which permission
each endpoint requires is the **Permission** column of [API Endpoints](#api-endpoints) above.

## Project Structure

Per-module responsibilities are tabulated in [`AGENTS.md`](AGENTS.md#nestjs-module-layout); the
`src/modules/` subdirectories below are exactly the modules in that table. The four top-level
`src/` directories and the dependency rule between them are described in
[`AGENTS.md`](AGENTS.md#source-layout).

```
apps/api/
├── src/
│   ├── main.ts               # Entry point — creates the Nest app, calls configureApp, listens
│   ├── bootstrap.ts          # helmet/cors/cookie-parser, setGlobalPrefix + enableVersioning, pino, Swagger
│   ├── app.module.ts         # Root module: global pipe/filter/interceptor/guards + feature modules
│   ├── core/                 # Infrastructure — owns connections, config, and global cross-cutting wiring
│   │   ├── config/           # env.validation.ts (Joi, fail-fast), pino.config.ts, auth-throttle.ts, api-version.ts
│   │   ├── database/         # PrismaService (Prisma client lifecycle)
│   │   ├── redis/            # REDIS_CLIENT provider (ioredis), global RedisModule
│   │   ├── queue/            # BullMQ notification queue + NotificationProcessor
│   │   ├── filters/          # AllExceptionsFilter
│   │   └── interceptors/     # TransformInterceptor (the response envelope)
│   ├── shared/               # Stateless helpers with no infrastructure of their own
│   │   ├── dto/              # Envelope/Payload response types
│   │   ├── pagination/       # pagination.dto.ts and friends
│   │   ├── decorators/       # @CurrentUser and other parameter decorators
│   │   ├── validators/       # custom class-validator rules
│   │   └── utils/            # to-snake-keys.ts, duration.ts
│   ├── tenancy/              # OrgGuard, ProjectGuard, PermissionsGuard, MembershipService, @OrgScoped/@ProjectScoped
│   └── modules/              # One self-contained feature module per directory
│       ├── auth/             # Signup/signin/refresh/logout, password reset, JWT, cookies, token rotation
│       ├── users/            # User lookups shared by other modules
│       ├── permissions/      # GET /api/v1/permissions reference list
│       ├── orgs/             # Org CRUD + system-roles.ts (per-org system roles)
│       ├── roles/            # Custom role CRUD, permission assignment
│       ├── members/          # Org + project membership listing / role changes / removal
│       ├── projects/         # Project CRUD, org-scoped
│       ├── todos/            # Example project-scoped resource, paginated
│       ├── invitations/      # Invite/preview/accept/decline/revoke/resend + notifier seam
│       ├── health/           # GET /health, /health/live, /health/ready — outside the prefix, version-neutral
│       └── maintenance/      # CleanupService — nightly cron pruning expired auth/invitation rows
├── prisma/
│   ├── schema.prisma         # Domain models (@map/@@map keep the DB snake_case)
│   ├── migrations/           # Prisma migrations (single 0_init baseline)
│   └── seed.ts               # Idempotent seed of the canonical permissions
├── test/                     # Jest configs + e2e specs, helpers, globalSetup, Redis reset hook
│                             # (unit and integration specs live beside the code they cover)
├── .editorconfig             # Editor configuration
├── .env.example              # Environment variable template
├── .env.test.example         # Test environment template (valid dummy secrets — copy to .env.test)
├── .gitignore
├── .oxlintrc.json            # Oxlint configuration
├── .prettierignore           # Excludes generated output and vendored files
├── .prettierrc.json          # Prettier configuration
├── AGENTS.md                 # Facts and invariants for agents (CLAUDE.md symlinks to it)
├── CLAUDE.md                 # Symlink → AGENTS.md
├── Dockerfile                # Runtime image — runs node dist/main
├── README.md                 # This file
├── TEMPLATE_GUIDE.md         # Guide for extending this template
├── nest-cli.json             # Nest CLI configuration (incl. the @nestjs/swagger plugin)
├── prisma.config.ts          # Prisma CLI config — imports dotenv/config, points db seed at seed.ts
├── tsconfig.json             # TypeScript configuration
├── tsconfig.build.json       # Build-only overrides (excludes tests from dist/)
└── package.json
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production` in your environment
2. Use strong, random JWT secrets
3. Configure your production database URL
4. Ensure `PORT` is set (or use default 3000)

### Running Migrations

Always run migrations before starting the production server:

```bash
corepack pnpm db:migrate       # prisma migrate deploy
```

### Starting the Server

```bash
corepack pnpm build
corepack pnpm start
```

### Dependency Placement

Three dependency choices look wrong at first glance and are deliberate — do not "fix" them:

- **`prisma` and `dotenv` are production dependencies** on purpose. The runtime Docker image runs `prisma migrate deploy` and `prisma db seed`, and `prisma.config.ts` imports `dotenv/config` at runtime — moving either to `devDependencies` breaks migrations and seeding in the deployed container.
- **`express` is a direct dependency** because `bootstrap.ts` imports the `json`/`urlencoded` body parsers from it as values, rather than reaching them through `@nestjs/platform-express`.
- The auto-generated banner in `prisma.config.ts` suggests installing `prisma` with `--save-dev`. That advice is wrong for this image; ignore it.

### Security Considerations

- Use HTTPS in production
- JWT secrets are validated at startup (minimum 32 characters, no placeholders)
- Tokens delivered as httpOnly cookies — not accessible via JavaScript (XSS protection)
- Passwords require uppercase, lowercase, digit, and special character
- Account lockout after 5 failed login attempts (15-minute lock)
- Helmet enforces strict Content Security Policy (`default-src: 'none'`), `no-referrer` policy, and HSTS with preload
- CORS is restricted to explicit origins configured via `CORS_ALLOWED_ORIGINS`, with credentials support
- Rate limiting on the global limiter, configurable via env vars. Counters live in Redis, so they are shared across instances; the limit you configure is the limit the deployment enforces, not the limit per process
- Request body size is capped at 100kb to prevent payload abuse
- Reset tokens and refresh tokens are stored only as hashes; reusing a revoked refresh token invalidates the whole session family
- `SWAGGER_ENABLED` defaults to `false` when `NODE_ENV=production`, so the route and schema surface is not published unless you opt in
- Cookies, `Authorization`, and `Set-Cookie` are redacted from logs
- Configure database firewall rules
- Keep dependencies updated with `corepack pnpm audit`
- Never commit `.env` file to version control

## Using This Template

See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) for detailed instructions on:

- NestJS module architecture patterns
- Adding new features step-by-step
- Prisma schema, migrations, and seeding
- Authentication & authorization
- Input validation patterns
- Common recipes (pagination, sorting, filtering)
