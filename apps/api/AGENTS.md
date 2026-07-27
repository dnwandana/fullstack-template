# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant **NestJS 11** RESTful API with an Organization → Project → Resource hierarchy, PostgreSQL via **Prisma**, JWT authentication over httpOnly cookies, and RBAC permissions. TypeScript compiled to CommonJS (`nest build` → `dist/`), Node.js v24+ (pinned in `.nvmrc`).

## Commands

```bash
corepack pnpm dev              # nest start --watch (dev server)
corepack pnpm start            # node dist/main (production runtime)
corepack pnpm build            # nest build → dist/
corepack pnpm test             # Jest — e2e AND unit specs, real PostgreSQL (.env.test)
corepack pnpm test:unit        # Jest — unit specs only, no database required (seconds)
corepack pnpm test:watch       # Jest in watch mode
corepack pnpm test:cov         # Jest with coverage
corepack pnpm lint             # Oxlint
corepack pnpm lint:fix         # Oxlint --fix
corepack pnpm format           # Prettier write (--write . — includes this file)
corepack pnpm db:migrate       # prisma migrate deploy
corepack pnpm migrate:dev      # prisma migrate dev (creates a new migration in dev)
corepack pnpm db:seed          # prisma db seed (17 canonical permissions, idempotent)
corepack pnpm db:generate      # prisma generate (regenerate the client after schema edits)
corepack pnpm prisma:pull      # prisma db pull (introspect the DB into schema.prisma)
```

`start:prod` is a byte-identical alias of `start` (both `node dist/main`); the Docker image calls `start:prod`.

No pre-commit hooks are configured — run `corepack pnpm lint:fix && corepack pnpm format` yourself after editing. **Migrations never run automatically** — apply them explicitly on every environment.

## Architecture

### NestJS module layout

Each feature is a self-contained module under `src/<feature>/` (`*.module.ts`, `*.service.ts`, `*.controller.ts`, plus a `dto/` folder of class-validator DTOs). Services hold business logic and talk to Prisma; controllers are thin (params → service → envelope).

| Module        | Responsibility                                                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma`      | `PrismaService` — the Prisma client, connected on boot, disconnected on shutdown                                                                                                                                                          |
| `auth`        | Signup/signin/refresh/logout + password reset; JWT (`token.service`), cookies (`cookie.service`), Argon2 (`password.service`), refresh-token rotation (`refresh-token.service`), reset tokens (`password-reset.service`)                  |
| `users`       | User lookups (`findSafeById`, etc.) shared by other modules                                                                                                                                                                               |
| `permissions` | `GET /api/permissions` reference list                                                                                                                                                                                                     |
| `orgs`        | Org CRUD; creates the four system roles per org (see `system-roles.ts`)                                                                                                                                                                   |
| `roles`       | Custom role CRUD, permission assignment                                                                                                                                                                                                   |
| `members`     | Org + project membership listing / role changes / removal (last-owner invariant)                                                                                                                                                          |
| `projects`    | Project CRUD, org-scoped                                                                                                                                                                                                                  |
| `todos`       | Example project-scoped resource, paginated                                                                                                                                                                                                |
| `invitations` | Invite/preview/accept/decline/revoke/resend + pending-account backfill                                                                                                                                                                    |
| `health`      | `GET /health`, `/health/live`, `/health/ready` — all outside the global prefix, `@Public()` and throttle-skipped at the class level                                                                                                       |
| `maintenance` | `CleanupService` — `@Cron` job pruning expired auth/invitation rows (no controller)                                                                                                                                                       |
| `tenancy`     | `OrgGuard`, `ProjectGuard`, `PermissionsGuard`, `MembershipService` (no controller)                                                                                                                                                       |
| `common`      | Envelope interceptor, exception filter, param decorators, DTO/response types, `pagination/` (`PaginationQueryDto`, `ListQueryDto`, `PaginationService`), `to-snake-keys.ts`, `validators/match.validator.ts`, `uuid` + `duration` helpers |
| `config`      | `env.validation.ts` (Joi startup validation), `pino.config.ts`, `auth-throttle.ts` (no controller)                                                                                                                                        |

### Project structure

The tree below is the owner copy — `README.md` links here rather than restating it. The `src/`
directories are exactly the fifteen modules in the table above.

```
apps/api/
├── src/
│   ├── main.ts               # Entry point — creates the Nest app, calls configureApp, listens
│   ├── bootstrap.ts          # helmet/cors/cookie-parser, setGlobalPrefix("api"), pino logger, Swagger
│   ├── app.module.ts         # Root module: global pipe/filter/interceptor/guards + feature modules
│   ├── prisma/               # PrismaService (Prisma client lifecycle)
│   ├── auth/                 # Signup/signin/refresh/logout, password reset, JWT, cookies, token rotation
│   ├── users/                # User lookups shared by other modules
│   ├── permissions/          # GET /api/permissions reference list
│   ├── orgs/                 # Org CRUD + system-roles.ts (per-org system roles)
│   ├── roles/                # Custom role CRUD, permission assignment
│   ├── members/              # Org + project membership listing / role changes / removal
│   ├── projects/             # Project CRUD, org-scoped
│   ├── todos/                # Example project-scoped resource, paginated
│   ├── invitations/          # Invite/preview/accept/decline/revoke/resend + notifier seam
│   ├── health/               # GET /health, /health/live, /health/ready — outside the prefix, throttle-skipped
│   ├── maintenance/          # CleanupService — nightly cron pruning expired auth/invitation rows
│   ├── tenancy/              # OrgGuard, ProjectGuard, PermissionsGuard, MembershipService
│   ├── common/               # Envelope interceptor, exception filter, decorators, duration/DTO helpers
│   └── config/               # env.validation.ts (Joi, fail-fast at startup), pino.config.ts, auth-throttle.ts
├── prisma/
│   ├── schema.prisma         # 12 domain models (@map/@@map keep the DB snake_case)
│   ├── migrations/           # Prisma migrations (single 0_init baseline)
│   └── seed.ts               # Idempotent seed of the 17 canonical permissions
├── test/                     # Jest e2e + unit suites (Supertest against real PostgreSQL)
├── .editorconfig             # Editor configuration
├── .env.example              # Environment variable template
├── .env.test.example         # Test environment template (valid dummy secrets — copy to .env.test)
├── .nvmrc                    # Node.js version (24)
├── AGENTS.md                 # AI assistant reference (CLAUDE.md symlinks to it)
├── Dockerfile                # Runtime image — runs start:prod (node dist/main)
├── TEMPLATE_GUIDE.md         # Guide for extending this template
├── nest-cli.json             # Nest CLI configuration (incl. the @nestjs/swagger plugin)
├── prisma.config.ts          # Prisma CLI config — imports dotenv/config, points db seed at seed.ts
├── tsconfig.json             # TypeScript configuration
└── package.json
```

### Bootstrap & global providers

`src/main.ts` creates the app (`bufferLogs: true`, `bodyParser: false`) and calls `configureApp` from `src/bootstrap.ts`, which applies (in order): the pino `Logger`, `trust proxy = 1`, `helmet` (CSP `default-src 'none'`, `no-referrer`, HSTS), CORS (origins from `CORS_ALLOWED_ORIGINS`, `credentials: true`), `express.json`/`urlencoded` (100kb), `cookie-parser`, `setGlobalPrefix("api", { exclude: ["health", "health/live", "health/ready"] })`, the Swagger document (mounted at `api/docs` **after** the prefix so documented paths carry `/api`, and only when `ConfigService.get("SWAGGER_ENABLED") === "true"`), and `enableShutdownHooks()`.

`bodyParser: false` is load-bearing: it disables Nest's built-in parser so the explicit `express.json`/`urlencoded` calls in `configureApp` are the only ones registered, which is what makes the 100kb limit real. `test/create-test-app.ts` mirrors the flag.

Each `exclude` entry is an **exact** route path, not a prefix — `"health"` alone does not cover `health/live`. CORS also sets `allowedHeaders: ["Content-Type", "X-Request-Id"]` and `exposedHeaders: ["X-Request-Id"]` so a SPA can read the correlation id back. CORS also restricts `methods` to `["GET", "POST", "PUT", "DELETE"]` (`bootstrap.ts`), so a `PATCH` route would be rejected at the preflight even if a controller defined it.

`src/app.module.ts` wires the global cross-cutting providers:

- `APP_PIPE` → `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — unknown body fields are rejected, DTOs are class-transformed.
- `APP_INTERCEPTOR` → `TransformInterceptor` — normalizes every response into the success envelope.
- `APP_FILTER` → `AllExceptionsFilter` — normalizes every error into the error envelope.
- `APP_GUARD` → `ThrottlerGuard` (rate limiting) then `JwtAuthGuard` (authentication).
- `ConfigModule.forRoot({ isGlobal: true, validate })` — env validated at startup (fail-fast).
- `LoggerModule` (nestjs-pino) — request id genned/validated from `x-request-id` and echoed back; `pino-pretty` in non-production.
- `ThrottlerModule.forRootAsync` — one `general` limiter, 15-min window, `limit` read through `ConfigService.get("RATE_LIMIT_GENERAL_MAX")` (never `process.env`: Joi's coercion and default only exist on the validated config object). `@SkipThrottle({ general: true })` on `HealthController` exempts all health routes. `AuthController` narrows the same limiter with a class-level `@Throttle({ general: { limit: RATE_LIMIT_AUTH_MAX, ttl: 15m } })`; that one still reads `process.env` because decorator arguments are evaluated before the DI container exists. That decorator argument comes from `authThrottleLimit()` (`src/config/auth-throttle.ts`), which mirrors Joi's 1..50 integer constraint and **throws at import time** on an out-of-range value — the fail-fast `ConfigService` cannot provide this early (the old `Number(x ?? 10)` yielded `NaN`, which the throttler treats as no limit at all). **The default store is in-memory, so every limit is per process** — a multi-instance deployment needs a shared store.
- `ScheduleModule.forRoot()` — required for `@Cron` to fire at all. Without it `CleanupService`'s job is silently inert.

### Guard stack (auth → tenant → permission)

Guards run in registration order: **global guards first, then controller-level, then handler metadata.** The effective order for a tenant-scoped route is:

1. **`ThrottlerGuard`** (global) — rate limiting.
2. **`JwtAuthGuard`** (global) — authentication. Verifies the `access_token` cookie and sets `req.user = { id }`. Routes marked `@Public()` (the health routes, invitation preview, signup/signin/refresh/logout, forgot/reset password) bypass it.

   **`RefreshTokenGuard`** (`src/auth/guards/refresh-token.guard.ts`) is a _second_ authentication path, applied with `@UseGuards` on `POST /api/auth/refresh` and `POST /api/auth/logout` (`auth.controller.ts`). Those routes are `@Public()` with respect to `JwtAuthGuard`, but they are not unauthenticated: this guard verifies the `refresh_token` cookie (rejecting a token whose `type` claim is not `"refresh"`) and also sets `req.user = { id }`. Any code reading `req.user` must account for both origins.

3. **`OrgGuard`** (applied by `@OrgScoped`/`@ProjectScoped` on `/orgs/:org_id/...` controllers) — validates `org_id` is a UUID, loads the org, verifies membership via `MembershipService.resolveOrg`, sets `req.org` + `req.permissions`. `400` invalid id, `404` unknown org, `403` non-member. The 404/403 split is a **deliberate** existence disclosure to authenticated users (L-13, specified in the rebuild design): org ids are UUIDs, so enumeration is impractical, and non-members get an accurate error. Do not "fix" it to a uniform 404. `ProjectGuard` intentionally does not mirror it.
4. **`ProjectGuard`** (added by `@ProjectScoped` on nested `/:project_id/...` controllers) — validates `project_id`, loads the project scoped to the org, **merges project-level permissions into the org permissions**, sets `req.project`. `404` if not found.
5. **`PermissionsGuard`** — reads the `@RequirePermission("<name>")` metadata for the handler and throws `403` unless `req.permissions.includes(name)`. Handlers with no `@RequirePermission` pass through.

Authorize a handler with the composite decorators from `src/tenancy/scoped.decorators.ts`: `@OrgScoped(permission?)` for `/orgs/:org_id/...` controllers, `@ProjectScoped(permission?)` for nested `/:project_id/...` controllers. `OrgScoped` composes `UseGuards(OrgGuard, PermissionsGuard)`; `ProjectScoped` composes `UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)`. The `permission` argument is optional — pass it when every handler on the controller shares one permission, otherwise apply `@RequirePermission("<name>")` per method (what `TodosController` does with its bare class-level `@ProjectScoped()`). Read context with the `@CurrentUser`, `@CurrentOrg`, `@CurrentProject`, and `@CurrentPermissions` param decorators.

Do not hand-roll the raw guard list. Guard order is a contract — `ProjectGuard` reads `req.org` set by `OrgGuard`, and `PermissionsGuard` reads `req.permissions` set by both — and `scoped.decorators.ts` is the only place that order is written down (L-7).

**Permission resolution**: project permissions merge with org permissions (deduped). Cross-project visibility keys off the `project:read_all` **permission**, never a role name — `ProjectsController.list` returns every project in the org when `req.permissions` includes `project:read_all`, otherwise only the caller's project memberships. Owner and admin get it by default through `SYSTEM_ROLE_PERMISSIONS`, and a custom role granted it behaves identically. Do not reintroduce role-name checks such as the old `ADMIN_ROLES` set.

### Response envelope

Handlers return a plain payload; `TransformInterceptor` normalizes it. The **success** envelope is:

```json
{
  "message": "OK",
  "data": {},
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

- `message` defaults to `"OK"` when a handler returns a bare value; controllers set `"Created"` on `POST`s.
- `data` is the resource (object for single, array for list, `null` for deletes).
- `pagination` is present only on paginated list endpoints.

The **error** envelope (from `AllExceptionsFilter`) is always:

```json
{ "message": "…", "data": null, "request_id": "…" }
```

with the thrown `HttpException`'s status. `class-validator` failures (arrays of messages) are **flattened to a single string** joined by `"; "`. Non-Nest errors carrying an http-errors `status`/`statusCode` (e.g. body-parser `PayloadTooLargeError`) surface that real status instead of collapsing to 500; in production, non-`HttpException` messages are replaced with the generic status text.

Prisma's `P2025` ("record not found", thrown by `update`/`delete` against a missing row) is mapped to `404 "Not found"` by `all-exceptions.filter.ts` before the generic non-`HttpException` handling runs, so services do not need an existence check purely to produce a 404.

### Prisma access

`PrismaService` (in `src/prisma/`) extends `PrismaClient` and manages its lifecycle (`$connect` on `onModuleInit`, `$disconnect` on `onModuleDestroy`). Inject it into any service:

```typescript
constructor(private readonly prisma: PrismaService) {}
```

The schema (`prisma/schema.prisma`) is snake_case in the DB but camelCase in the client (`@map`/`@@map`). Services translate the Prisma camelCase rows back to the **snake_case API contract** the SPA consumes (see the shared `toSnakeKeys` generic in `src/common/to-snake-keys.ts`, imported by the `invitations`, `members`, `todos`, `roles`, `permissions`, `projects`, and `orgs` services). Multi-row invariants use PostgreSQL locks inside `prisma.$transaction` — `pg_advisory_xact_lock` for the last-owner check, `SELECT … FOR UPDATE` for invitation accept, and the non-blocking `pg_try_advisory_xact_lock` for the nightly cleanup job.

### Request context

```
req.id          // Request ID (pino genReqId, from x-request-id or a fresh UUID)
req.user        // { id } — set by JwtAuthGuard (access_token) or RefreshTokenGuard (refresh_token)
req.org         // { id, role_name } from OrgGuard
req.project     // { id } from ProjectGuard
req.permissions // ["todos:create", ...] merged org + project permissions
```

### Authentication flow

- `POST /api/auth/signup` → creates user, returns `{ id, name, email }` (no tokens). Backfills any pending invitations for that email (best-effort). Email required + unique; name is a display name. **Deliberate trade-off (L-14)**: signup reveals when an email is taken. Signin and forgot-password are enumeration-hardened; signup is not, because the "if an account exists we've emailed you" pattern requires real email delivery, which the template does not ship. Revisit when a mailer lands — do not "fix" this alone.
- `POST /api/auth/signin` → authenticates by email + password, stores the refresh-token hash, sets `access_token` + `refresh_token` httpOnly cookies, returns `{ id, name, email }`.
- `POST /api/auth/refresh` → **token rotation**: claims the old refresh token atomically (`claimForRotation` sets `revokedAt` only where still null — a read-check-revoke sequence would let two concurrent presenters both rotate), stores the new hash, sets new cookies. **Reuse detection**: the row is looked up with `findByToken` (which deliberately does _not_ filter on `revokedAt`, so a replay is distinguishable from a forgery); if the presented token is already revoked — or loses the atomic claim — every refresh token for that user is revoked, the cookies are cleared, a warning is logged, and the request gets `401 "Invalid refresh token"`.
- `POST /api/auth/logout` → revokes the refresh token, clears cookies. Idempotent.
- `GET /api/auth/me` → authenticated; confirms the `access_token` cookie is still valid and returns the user.
- `POST /api/auth/forgot-password` → `{ email }`, always `200` with a neutral message. Unknown addresses are a silent no-op (no enumeration). Issuing a new token voids any earlier outstanding ones — the newest link is the only valid link. Delivery goes through `PasswordResetNotifierService`, whose always-on log line carries the user id (the address is PII); the reset URL is logged at `debug` **only** when `NODE_ENV === "development"`.
- `POST /api/auth/reset-password` → `{ token, password, confirmation_password }`. `token` is 64 hex chars; only its SHA-256 hash is stored. Claimed atomically via `updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } } })` — 0 rows updated means `400 "Invalid or expired reset token"`. TTL is 1 hour. Success is a full credential rotation: it clears `failedLoginAttempts`/`lockedUntil`, revokes every outstanding refresh token, and voids every other outstanding reset token for that user.

Cookies: `access_token` (path `/api`) and `refresh_token` (path `/api/auth`), both httpOnly, `SameSite=Strict`, `Secure` in production. `SameSite=Strict` is a **deliberate** choice (L-24): it requires the SPA and API to share a registrable domain — the shipped `app.<DOMAIN>` / `api.<DOMAIN>` topology qualifies; splitting them across registrable domains silently breaks auth, and changing it means editing `cookie.service.ts`, not an env var. `maxAge` is **derived** from `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` via `parseDuration` (`src/common/duration.ts`) rather than hard-coded, so cookie and JWT lifetimes cannot drift; `clear()` uses `maxAge: 0`. JWT pinned to HS256. Signin hardening (constant-time dummy hash for unknown emails, account lockout after 5 failed attempts for 15 min) is preserved from the Express implementation.

### Multi-tenancy

**Hierarchy**: Organization → Project → Resources (Todos). Shared database, tenant columns (`org_id`, `project_id`); no schema-per-tenant. Users may belong to many orgs and many projects.

### Permissions

**RBAC**: permission-per-role. Each org gets four system roles on creation; owners may add custom roles with granular permissions. The 17 canonical permissions and the system-role → permission map live in **`src/orgs/system-roles.ts`** (`ALL_PERMISSIONS`, `SYSTEM_ROLE_PERMISSIONS`):

| Role   | Permissions                                                       |
| ------ | ----------------------------------------------------------------- |
| owner  | All 17                                                            |
| admin  | All except `org:delete` and `org:manage_roles` (15)               |
| member | `org:read`, `project:read`, `todos:*` (create/read/update/delete) |
| viewer | `org:read`, `project:read`, `todos:read`                          |

`project:read_all` ("view all projects in the organization, not only those you belong to") is the 17th; owner and admin have it, member and viewer do not. It exists so cross-project visibility is a grantable permission instead of a role-name special case.

The same 17 permission names (with descriptions) are seeded by `prisma/seed.ts` (`PERMISSION_NAMES`), which is the single source of truth also imported by the e2e test setup. Keep `ALL_PERMISSIONS` and `PERMISSION_NAMES` in lockstep — a name in one and not the other is not caught at compile time.

### Invitation system

Invite by email, 7-day expiry, accept/decline/revoke/resend. Tokens are hashed (SHA-256) — only the hash (`token_hash`) is stored; the raw token is returned only at create/resend so an admin can deliver the link by hand (no mail provider ships — `InvitationNotifierService` is the seam; the accept URL is built by `invitation-url.ts`).

- **Public preview**: `GET /api/invitations/:invitation_id/preview?token=<64hex>` is `@Public()` — a logged-out invitee can see what they were invited to. Possession of the raw token is the only credential; `404` for both an unknown invitation and a wrong token (no enumeration). Returns `{ id, org_name, project_name, inviter_name, role_name, invitee_email, status, expires_at, is_expired, requires_signup }`.
- **Accept**: `POST /api/invitations/:invitation_id/accept` is **authenticated and requires the raw token in the body** — `{ token: "<64 hex chars>" }` (`AcceptInvitationDto`). Two gates apply, in order: the service matches on `{ id: invitationId, tokenHash: hash(rawToken) }` and throws `404 "Invitation not found"` when either half is wrong (so a wrong token cannot probe which invitation ids exist), then checks ownership — the logged-in user's id/email must match `invitee_id`/`invitee_email`, else `403 "This invitation does not belong to you"`. Being the invitee is no longer sufficient on its own; the raw link is required too. Uses `SELECT … FOR UPDATE` inside a transaction to serialize concurrent accepts. Project invitations auto-add the user to the parent org as `viewer` if not already a member.
- **Pending-account invitations**: inviting an unregistered address is valid (no 404). Signup backfills `invitee_id` on matching pending/unexpired invitations so they appear in `GET /api/invitations`.
- **Duplicate prevention**: a pending invitation for the same `(invitee_email, org_id, project_id)` scope is rejected with `400 "A pending invitation already exists for this email"`.
- **Expiry is derived, never written** — evaluated live against `expires_at`.
- **Invitation-only membership (I-9)**: there is **no** direct "add member" endpoint, by design. Membership rows are created only by accepting an invitation (or by creating the org/project). Do not add a POST-a-member route — every join must stay invitee-consented and flow through the invitation system.

### Environment validation

`src/config/env.validation.ts` (Joi) runs via `ConfigModule`'s `validate` hook at startup, `abortEarly: false`. JWT secrets must be ≥32 chars, must differ, and must not start with `changeme`. `RATE_LIMIT_AUTH_MAX` capped at 50. Failure throws before the app boots (fail-fast).

Two things to know when reading env values elsewhere:

- **Duration grammar**: `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` must match `/^\d+[smhd]$/`. This is deliberately narrower than what `@nestjs/jwt` accepts (no `1w`) because the same string also feeds `parseDuration` for the cookie `maxAge` and the `refresh_tokens` row.
- **Defaults are not written back to `process.env`.** `@nestjs/config` applies Joi's defaults only to the validated object behind `ConfigService`, so any code reading `process.env.X` directly misses them. Read through `ConfigService` unless you are in a decorator argument, which is evaluated before the container exists.

`LOG_LEVEL` accepts only `error | warn | info | debug` — pino's `trace` and `fatal` are rejected. `SWAGGER_ENABLED` has a function default that resolves to `"false"` when `NODE_ENV === "production"` and `"true"` otherwise, which is why it must stay declared last in the schema (Joi resolves keys in declaration order and reads siblings off `parent`).

### Scheduled maintenance

`src/maintenance/cleanup.service.ts` runs `@Cron(CronExpression.EVERY_DAY_AT_3AM)`. It returns immediately when `CLEANUP_ENABLED === "false"`. Deletes run in bounded batches (10k rows), each in its own short transaction that takes `pg_try_advisory_xact_lock(hashtext('auth-cleanup'))` — non-blocking, so a replica that loses the lock stops its sweep instead of queueing behind the winner. The lock is transaction-scoped, so it is released between batches: two replicas may interleave batches of the same sweep, which is harmless (disjoint rows, both make progress) — the lock prevents duplicated work, not concurrent runs. Batching caps WAL volume and lock time no matter how large the first-sweep backlog is. The swept `expires_at`/`revoked_at` columns are indexed (see `schema.prisma`). Grace periods: refresh tokens and password-reset tokens 7 days, invitations 30 days. Retention is always measured from `expiresAt`/`revokedAt`, never `createdAt`, so a long-lived token is not deleted while still valid.

### Pagination

List endpoints accept a pagination DTO (`page`, `limit`, `sort_by`, `sort_order`, `search` — see `src/common/pagination/pagination.dto.ts`) and services return `{ data, pagination }`, which the controller passes straight into the envelope. Pagination meta shape (`{ current_page, total_pages, total_items, items_per_page, has_next_page, has_previous_page, next_page, previous_page }`) is unchanged from the Express era. Search terms are escaped for PostgreSQL `ILIKE`.

Two DTOs exist and their defaults differ deliberately. `PaginationQueryDto` defaults `limit` to **10** and backs todos (via `ListTodosDto`, which narrows `sort_by` to `updated_at | title`). `ListQueryDto` extends it and defaults `limit` to **50**, backing org members, project members, and org invitations — those render whole-list UIs in the SPA that send no query params, so page 1 must hold a typical tenant. Both cap `limit` at 100. `sort_order` defaults to `desc`; `sort_by` has no default at the DTO layer, so each service resolves its own (todos falls back to `updated_at`).

## Endpoints

The full endpoint list — every method, path, and required permission — lives in
[`README.md`](README.md#api-endpoints). It is the only place that list is written down; adding or
renaming a route means editing it. Route _shape_ rules are documented here:

- **Global prefix**: `setGlobalPrefix("api", { exclude: ["health", "health/live", "health/ready"] })`
  in `bootstrap.ts`. Each `exclude` entry is an exact path, not a prefix, which is why the three
  health routes are listed individually; everything else is mounted under `/api`.
- **Tenancy prefixes**: org-scoped controllers mount at `orgs/:org_id/...`, project-scoped
  controllers nest under `orgs/:org_id/projects/:project_id/...`. The segment names are part of the
  contract — `OrgGuard` and `ProjectGuard` read `org_id` / `project_id` off `req.params`.
- **Guard composition**: `@OrgScoped(permission?)` / `@ProjectScoped(permission?)` from
  `src/tenancy/scoped.decorators.ts` supply the guard list and, optionally, the single permission
  the whole controller shares; otherwise apply `@RequirePermission("<name>")` per handler. See the
  guard stack section above for the order and why it must not be hand-rolled.
- **Methods**: CORS restricts `methods` to `GET`, `POST`, `PUT`, `DELETE`, so a `PATCH` route would
  be rejected at the preflight even if a controller defined it.
- **Two authentication origins**: `POST /api/auth/refresh` and `POST /api/auth/logout` are
  `@Public()` with respect to `JwtAuthGuard` but gated by `RefreshTokenGuard`; the invitation
  preview route is gated only by possession of the raw token.

## Adding a New Resource

1. **Scaffold** the module: `nest g module <resource>`, `nest g service <resource>`, `nest g controller <resource>` (or add `src/<resource>/{*.module,*.service,*.controller}.ts` + `dto/` by hand). Register the module in `app.module.ts` if the CLI didn't.
2. **Model**: add the table to `prisma/schema.prisma` with an `org_id` and/or `project_id` FK for tenant scoping, then `corepack pnpm migrate:dev` and `corepack pnpm db:generate`.
3. **Service**: inject `PrismaService`; scope every query by `org.id`/`project.id`. Return `{ data }` (and `{ pagination }` for lists).
4. **Controller**: `@Controller("orgs/:org_id/projects/:project_id/<resource>")`, `@ProjectScoped()`, `@RequirePermission("<name>")` per handler, `@CurrentOrg()`/`@CurrentProject()`/`@CurrentUser()` for context. Validate bodies with a class-validator DTO. Return `{ message, data, pagination? }`.
5. **Permissions**: add new permission names to `prisma/seed.ts` (`PERMISSION_NAMES` + descriptions) **and** to `src/orgs/system-roles.ts` (`ALL_PERMISSIONS` / the per-role lists in `SYSTEM_ROLE_PERMISSIONS`). Re-seed.
6. **Test**: add an e2e spec under `test/` asserting the envelope and each permission gate.

The OpenAPI document needs no manual step: the `@nestjs/swagger` CLI plugin in `nest-cli.json` (`introspectComments: true`, `dtoFileNameSuffix: [".dto.ts"]`) derives property types, optionality, and descriptions from the DTO source, so plain class-validator DTOs are documented without `@ApiProperty()` boilerplate. There is no checked-in `openapi.json` to update — the previous hand-maintained file was deleted precisely because it drifted.

## Environment Variables

Every variable, its default, and its validation constraint is documented once in
[`README.md`](README.md#configuration). Validation lives in `src/config/env.validation.ts` and runs
at startup — a missing or malformed variable aborts the boot rather than degrading. The reasoning
behind the deliberately narrow duration grammar and the `process.env`-versus-`ConfigService` trap
is in [Environment validation](#environment-validation) above.

`.env.example` is the operator-facing template; `.env.test.example` ships valid dummy secrets so the e2e suite boots from `cp .env.test.example .env.test` unchanged. Do not copy `.env.example` for tests — its `changeme_…` secrets are rejected by validation on purpose.

## Database

- **Schema**: `prisma/schema.prisma` — 12 domain models (`@map`/`@@map` keep the DB snake_case). `DATABASE_URL` drives the connection.
- **Models**: `User`, `Organization`, `Permission`, `Role`, `RolePermission`, `OrgMember`, `Project`, `ProjectMember`, `Invitation`, `Todo`, `RefreshToken`, `PasswordResetToken`.
- **Role FKs**: `OrgMember.role` and `ProjectMember.role` use `onDelete: Restrict`, not `Cascade` — deleting a role that is still assigned must not silently strip memberships. `RolesService` maps the resulting `P2003`/`P2014` to `400 "Cannot delete a role that is in use"`.
- **Migrations**: `prisma/migrations/` — `prisma migrate deploy` (prod) / `prisma migrate dev` (dev). Never automatic.
- **Seed**: `prisma/seed.ts` — idempotent upsert of the 17 canonical permissions (`prisma db seed`).
- **Dependency placement (deliberate)**: `prisma` and `dotenv` are **production** dependencies — the runtime image runs `prisma migrate deploy`/`prisma db seed`, and `prisma.config.ts` imports `dotenv/config` at runtime, so neither may move to `devDependencies`. `express` is a direct dependency because `bootstrap.ts` imports the `json`/`urlencoded` values from it rather than through `@nestjs/platform-express`. The auto-generated banner in `prisma.config.ts` suggesting `--save-dev` is wrong for this image — do not "fix" it.

## Testing

- **Runner**: Jest. `corepack pnpm test` uses `test/jest-e2e.json`, whose `testRegex` is `(\.e2e-spec|\.spec)\.ts$` — it runs **both** e2e and unit specs against real PostgreSQL from `.env.test`. `corepack pnpm test:unit` uses `test/jest-unit.json`, which excludes the seven database-backed specs by name (`testPathIgnorePatterns`) and needs no database.
- **Style**: boot the actual NestJS app (`test/create-test-app.ts`) and drive it with Supertest. `test/setup-e2e.ts` is a Jest `globalSetup` — it applies migrations and seeds the 17 permissions (re-exporting `seedPermissions` from `prisma/seed.ts` so suites share one implementation) **once** per run. It also exports `truncateAll`, which each spec calls itself; there is no automatic per-test truncation.
- **Coverage**: every module has an e2e spec — auth (incl. lockout and password reset), health (live/ready), orgs, roles, members, projects, todos, permissions, invitations (incl. accept-token enforcement), plus the generated OpenAPI document. Unit-style specs cover the cleanup job, cookie/duration helpers, env validation, pino redaction, request-id handling, and the seed.

## Code Style

- **Formatter**: Prettier — no semicolons, 2-space indent, 100-char width.
- **Linter**: Oxlint.
- **Language**: TypeScript (NestJS). Compiled to CommonJS in `dist/` — not `"type": "module"`.
- **File naming**: kebab-case (`refresh-token.service.ts`, `env.validation.ts`).
- **UUIDs**: `crypto.randomUUID()` from `node:crypto`.
- **Responses**: return `{ message, data, pagination? }`; the global `TransformInterceptor` normalizes it. Do not build responses by hand.
