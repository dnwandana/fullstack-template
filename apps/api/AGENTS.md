# AGENTS.md

Guidance for agents working in `apps/api`. This file holds facts and invariants; runnable
procedures, the command listing, the endpoint tables and the environment-variable reference all
live in [`README.md`](README.md).

## Project Overview

Multi-tenant **NestJS 11** RESTful API with an Organization → Project → Resource hierarchy, PostgreSQL via **Prisma**, JWT authentication over httpOnly cookies, and RBAC permissions. TypeScript compiled to CommonJS (`nest build` → `dist/`), Node.js v24+ — pinned in `.nvmrc`, `engines.node` in both `package.json`s, and the `node:24-alpine` base in both Dockerfiles. All four must move together.

## Commands

Every script is listed and annotated in [`README.md`](README.md#development-commands). Four things that listing cannot tell you:

- `corepack pnpm test` runs the **integration + e2e** tier only — `test/jest-e2e.json`'s `testRegex` is `(\.e2e-spec|\.int-spec)\.ts$`. It needs a reachable PostgreSQL **and Redis** from `.env.test`. `corepack pnpm test:unit` runs the disjoint unit tier and needs neither. See [Testing](#testing).
- `corepack pnpm format` is `prettier --write .` with no markdown exclusion, so it reformats this file.
- **Migrations never run automatically** — apply them explicitly on every environment.
- **`corepack pnpm build` must stay `nest build`.** Raw `tsc` produces a `dist/` whose `require()` calls still say `@core/...`, and Node resolves those against `node_modules`, so the image fails at startup with `MODULE_NOT_FOUND` rather than at build time. See [Path aliases](#path-aliases).

## Architecture

### Source layout

`src/` splits four ways, and the split is a dependency rule, not filing preference:

| Directory      | Holds                                                                                                                           | May import from                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `src/core/`    | Infrastructure that owns a connection or global wiring: `config/`, `database/`, `redis/`, `queue/`, `filters/`, `interceptors/` | `shared/` only                 |
| `src/shared/`  | Stateless helpers with no infrastructure of their own: `dto/`, `pagination/`, `decorators/`, `validators/`, `utils/`            | nothing in this app            |
| `src/tenancy/` | The org/project guard chain and `MembershipService` — cross-cutting authorization, not a feature                                | `core/`, `shared/`             |
| `src/modules/` | One self-contained feature module per directory                                                                                 | `core/`, `shared/`, `tenancy/` |

**The feature boundary rule: a module under `src/modules/` must not import from a sibling module's
internals.** If two features need the same thing, it moves down into `shared/` (if it is stateless)
or `core/` (if it owns infrastructure), or the owning module exports it from its own module class
for Nest DI. What it must never become is a reach across `../other-feature/other.service`. Two
features deliberately duplicate a small Prisma projection rather than share one — `roles.service.ts`
and `invitations.service.ts` each declare their own `select` shape, and the comment on
`invite-row.ts` records why: a shared projection couples two features' response contracts so that
widening one silently widens the other.

`src/modules/` holds exactly the features below; if the table and `ls src/modules/` ever disagree,
`ls` wins.

| Module        | Responsibility                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth`        | Signup/signin/refresh/logout + password reset; JWT (`token.service`), cookies (`cookie.service`), Argon2 (`password.service`), refresh-token rotation (`refresh-token.service`), reset tokens (`password-reset.service`) |
| `users`       | User lookups (`findSafeById`, etc.) shared by other modules                                                                                                                                                              |
| `permissions` | `GET /api/v1/permissions` reference list                                                                                                                                                                                 |
| `orgs`        | Org CRUD; creates the system roles in `SYSTEM_ROLE_NAMES` per org (see `system-roles.ts`)                                                                                                                                |
| `roles`       | Custom role CRUD, permission assignment                                                                                                                                                                                  |
| `members`     | Org + project membership listing / role changes / removal (last-owner invariant)                                                                                                                                         |
| `projects`    | Project CRUD, org-scoped                                                                                                                                                                                                 |
| `todos`       | Example project-scoped resource, paginated                                                                                                                                                                               |
| `invitations` | Invite/preview/accept/decline/revoke/resend + pending-account backfill                                                                                                                                                   |
| `health`      | `GET /health`, `/health/live`, `/health/ready` — outside the global prefix, `VERSION_NEUTRAL`, `@Public()` and throttle-skipped at the class level                                                                       |
| `maintenance` | `CleanupService` — `@Cron` job pruning expired auth/invitation rows (no controller)                                                                                                                                      |

The annotated directory tree lives in [`README.md`](README.md#project-structure).

### Path aliases

`tsconfig.json` declares six aliases. They exist so a file move does not rewrite every importer, and
so the layering above is visible at the import site.

| Alias        | Resolves to     |
| ------------ | --------------- |
| `@core/*`    | `src/core/*`    |
| `@shared/*`  | `src/shared/*`  |
| `@modules/*` | `src/modules/*` |
| `@tenancy/*` | `src/tenancy/*` |
| `@app/*`     | `src/*`         |
| `@test/*`    | `test/*`        |

**Three places must agree**: `paths` in `tsconfig.json`, and the `moduleNameMapper` block in _both_
`test/jest-unit.json` and `test/jest-e2e.json`. The Jest entries carry a `<rootDir>/` prefix because
both configs set `rootDir: ".."`. Adding an alias to `tsconfig.json` alone type-checks fine and then
fails at runtime under Jest with `Cannot find module` — the compiler and the test runner resolve
modules independently.

**What rewrites the aliases in `dist/` is `nest build`, not `tsc`.** The Nest CLI runs
`@nestjs/cli`'s bundled `tsconfig-paths` AST transformer before emit, turning `@core/...` into a
relative `require()`. Plain `tsc` does not do this — it type-checks the aliases and then emits the
alias string verbatim, producing a `dist/` that only fails when Node tries to resolve it. This is
why `package.json`'s `build` script is `nest build` and must stay that way. (`packages/contracts`
builds with plain `tsc`, which is correct: it declares no path aliases.)

There is one structural gap: **no alias covers the `src/` root as a bare specifier.** `baseUrl` is
`"./"`, so an import of `src/app.module` type-checks and then throws `MODULE_NOT_FOUND` at runtime.
Test files reach the root with a relative `../src/app.module`; use `@app/app.module` in new code.

### No barrel files

Do not add `index.ts` re-export barrels inside `src/`. A barrel makes every importer of one symbol
load the whole directory, which drags unrelated providers into a unit test's module graph and turns
a leaf change into a wide rebuild; it also hides the layering the aliases exist to make visible.
Import the file that declares the symbol.

The single sanctioned exception is `packages/contracts/src/index.ts`, which is the package's public
surface — a type-only package has no runtime graph to drag in.

### Shared response contracts

`@fullstack/contracts` (`packages/contracts`) is a dependency-free, **type-only** package: interfaces
describing the response bodies the SPA consumes. The API's response classes declare `implements` on
them, so a field renamed in a response class without a matching change to the contract is a compile
error rather than a runtime surprise for the client.

Two consequences worth knowing:

- Every import of it is `import type`. The build emits types-only `.js` stubs, so a value import
  would resolve to nothing at runtime. Keep imports `import type`.
- It has **zero runtime presence** in `apps/api/dist` even though it sits in `dependencies`.

### Bootstrap & global providers

`src/main.ts` creates the app (`bufferLogs: true`, `bodyParser: false`) and calls `configureApp` from `src/bootstrap.ts`, which applies (in order): the pino `Logger`, `trust proxy = 1`, `helmet` (CSP `default-src 'none'`, `no-referrer`, HSTS), CORS (origins from `CORS_ALLOWED_ORIGINS`, `credentials: true`), `express.json`/`urlencoded` (100kb), `cookie-parser`, `setGlobalPrefix(API_PREFIX, { exclude: ["health", "health/live", "health/ready"] })`, `enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION })`, the Swagger document (mounted at `api/docs` **after** the prefix so documented paths carry `/api/v1`, and only when `ConfigService.get("SWAGGER_ENABLED") === "true"`), and `enableShutdownHooks()`.

`bodyParser: false` is load-bearing: it disables Nest's built-in parser so the explicit `express.json`/`urlencoded` calls in `configureApp` are the only ones registered, which is what makes the 100kb limit real. `test/create-test-app.ts` mirrors the flag.

CORS also sets `allowedHeaders: ["Content-Type", "X-Request-Id"]` and `exposedHeaders: ["X-Request-Id"]` so a SPA can read the correlation id back. CORS also restricts `methods` to `["GET", "POST", "PUT", "DELETE"]` (`bootstrap.ts`), so a `PATCH` route would be rejected at the preflight even if a controller defined it.

### URI versioning

Every route is served under `/api/v1`. `API_PREFIX` (`"api"`) and `API_VERSION` (`"1"`) live in
`src/core/config/api-version.ts`, which also derives `ACCESS_COOKIE_PATH` (`/api/v1`) and
`REFRESH_COOKIE_PATH` (`/api/v1/auth`). That file is the source of truth for all four spellings.

- **`setGlobalPrefix`'s `exclude` and `enableVersioning` are independent.** Excluding a route from
  the prefix does **not** exclude it from the version segment. The health controller opts out of
  versioning separately, with `@Controller({ path: "health", version: VERSION_NEUTRAL })` — that
  decorator, not the `exclude` list, is what keeps `/health/live` from becoming `/v1/health/live`.
- Each `exclude` entry is an **exact** route path, not a prefix — `"health"` alone does not cover
  `health/live`.
- **Swagger UI is not versioned.** It is mounted at `api/docs` straight on the Express instance, so
  `enableVersioning` never sees it and there is no `/api/v1/docs`.
- **Cookie paths match by whole path segments**, so `/api/auth` does not cover `/api/v1/auth/refresh`.
  Bumping `API_VERSION` without moving the cookie paths with it logs every user out at their next
  refresh, silently. The production edge rewrites the same paths a second time
  (`nginx/templates/api.conf.template`), and nginx cannot import TypeScript — so those two files
  carry the same strings by hand and must change together.

### Global providers

`src/app.module.ts` wires the global cross-cutting providers:

- `APP_PIPE` → `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — unknown body fields are rejected, DTOs are class-transformed.
- `APP_INTERCEPTOR` → `TransformInterceptor` — normalizes every response into the success envelope.
- `APP_FILTER` → `AllExceptionsFilter` — normalizes every error into the error envelope.
- `APP_GUARD` → `ThrottlerGuard` (rate limiting) then `JwtAuthGuard` (authentication).
- `ConfigModule.forRoot({ isGlobal: true, validate })` — env validated at startup (fail-fast).
- `LoggerModule` (nestjs-pino) — request id genned/validated from `x-request-id` and echoed back; `pino-pretty` in non-production.
- `ThrottlerModule.forRootAsync` — one `general` limiter, 15-min window, `limit` read through `ConfigService.get("RATE_LIMIT_GENERAL_MAX")` (never `process.env`: Joi's coercion and default only exist on the validated config object). `@SkipThrottle({ general: true })` on `HealthController` exempts all health routes. `AuthController` narrows the same limiter with a class-level `@Throttle({ general: { limit: RATE_LIMIT_AUTH_MAX, ttl: 15m } })`; that one still reads `process.env` because decorator arguments are evaluated before the DI container exists. That decorator argument comes from `authThrottleLimit()` (`src/core/config/auth-throttle.ts`), which mirrors Joi's 1..50 integer constraint and **throws at import time** on an out-of-range value — the fail-fast `ConfigService` cannot provide this early (the old `Number(x ?? 10)` yielded `NaN`, which the throttler treats as no limit at all). `authThrottleLimit()` is the **one** config value in the app read straight from `process.env` rather than through `ConfigService`, and that is deliberate for exactly this reason. **The store is Redis** (`@nest-lab/throttler-storage-redis`), so counters are shared across instances instead of counted per process — which is also why the test tier must flush Redis between tests (see [Testing](#testing)).
- `ScheduleModule.forRoot()` — required for `@Cron` to fire at all. Without it `CleanupService`'s job is silently inert.
- `RedisModule` (`src/core/redis/`) — a **global** module providing the `REDIS_CLIENT` token (an ioredis client), used by the throttler storage and by BullMQ.
- `QueueModule` (`src/core/queue/`) — registers the BullMQ `notifications` queue and its `NotificationProcessor`.

### Redis and the notification queue

**Redis is required in every environment.** `REDIS_URL` has no default in the Joi schema. It is not
an optional accelerator: BullMQ has no in-memory driver, so an optional Redis with a fallback would
mean jobs are accepted and never run. Only the local Docker stack ships a `redis` service;
production points `REDIS_URL` at a managed instance, exactly as it does `DATABASE_URL`.

Two consumers:

- **Throttler storage** — rate-limit counters (see [Global providers](#global-providers)).
- **The `notifications` queue** (`NOTIFICATION_QUEUE` in `src/core/queue/queue.constants.ts`, stored
  under the Redis key prefix `bull:notifications:*`). `InvitationNotifierService` and
  `PasswordResetNotifierService` now only **enqueue**; `NotificationProcessor` is the single place a
  real mail provider gets wired in, and it runs off the request path. `NotificationJob` is a
  discriminated union on `kind`, and the processor's `default` branch assigns to `never` — adding a
  variant without a matching case is a compile error rather than a job that is acknowledged and
  silently never delivered.

**Boot behaviour with Redis unreachable is _not_ fail-fast, despite the "required" policy.** ioredis
reconnects indefinitely with growing backoff, and `Nest application successfully started` is logged
**after** the first `ECONNREFUSED`. A Redis-less instance boots, listens, serves traffic, and passes
its container healthcheck — because that healthcheck probes `/health/live`, which by design never
touches a dependency. `/health/ready` does not probe `REDIS_CLIENT` either, so nothing in the
running system reports the degradation. Treat the requirement as an operational contract, not
something the process enforces on itself.

### Guard stack (auth → tenant → permission)

Guards run in registration order: **global guards first, then controller-level, then handler metadata.** The effective order for a tenant-scoped route is:

1. **`ThrottlerGuard`** (global) — rate limiting.
2. **`JwtAuthGuard`** (global) — authentication. Verifies the `access_token` cookie and sets `req.user = { id }`. Routes marked `@Public()` (the health routes, invitation preview, signup/signin/refresh/logout, forgot/reset password) bypass it.

   **`RefreshTokenGuard`** (`src/modules/auth/guards/refresh-token.guard.ts`) is a _second_ authentication path, applied with `@UseGuards` on `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` (`auth.controller.ts`). Those routes are `@Public()` with respect to `JwtAuthGuard`, but they are not unauthenticated: this guard verifies the `refresh_token` cookie (rejecting a token whose `type` claim is not `"refresh"`) and also sets `req.user = { id }`. Any code reading `req.user` must account for both origins.

3. **`OrgGuard`** (applied by `@OrgScoped`/`@ProjectScoped` on `/orgs/:org_id/...` controllers) — validates `org_id` is a UUID, loads the org, verifies membership via `MembershipService.resolveOrg`, sets `req.org` + `req.permissions`. `400` invalid id, `404` unknown org, `403` non-member. The 404/403 split is a **deliberate** existence disclosure to authenticated users (L-13, specified in the rebuild design): org ids are UUIDs, so enumeration is impractical, and non-members get an accurate error. Do not "fix" it to a uniform 404. `ProjectGuard` intentionally does not mirror it.
4. **`ProjectGuard`** (added by `@ProjectScoped` on nested `/:project_id/...` controllers) — validates `project_id`, loads the project scoped to the org, **merges project-level permissions into the org permissions**, sets `req.project`. `404` if not found.
5. **`PermissionsGuard`** — reads the `@RequirePermission("<name>")` metadata for the handler and throws `403` unless `req.permissions.includes(name)`. Handlers with no `@RequirePermission` pass through.

Authorize a handler with the composite decorators from `src/tenancy/scoped.decorators.ts`: `@OrgScoped(permission?)` for `/orgs/:org_id/...` controllers, `@ProjectScoped(permission?)` for nested `/:project_id/...` controllers. `OrgScoped` composes `UseGuards(OrgGuard, PermissionsGuard)`; `ProjectScoped` composes `UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)`. The `permission` argument is optional — pass it when every handler on the controller shares one permission, otherwise apply `@RequirePermission("<name>")` per method (what `TodosController` does with its bare class-level `@ProjectScoped()`). Read context with the `@CurrentUser`, `@CurrentOrg`, `@CurrentProject`, and `@CurrentPermissions` param decorators.

Do not hand-roll the raw guard list. Guard order is a contract — `ProjectGuard` reads `req.org` set by `OrgGuard`, and `PermissionsGuard` reads `req.permissions` set by both — and `scoped.decorators.ts` is the only place that order is written down (L-7).

**Permission resolution**: project permissions merge with org permissions (deduped). Cross-project visibility keys off the `project:read_all` **permission**, never a role name — `ProjectsController.list` returns every project in the org when `req.permissions` includes `project:read_all`, otherwise only the caller's project memberships. Owner and admin get it by default through `SYSTEM_ROLE_PERMISSIONS`, and a custom role granted it behaves identically. Do not reintroduce role-name checks such as the old `ADMIN_ROLES` set.

### Response envelope

Handlers return a plain payload; `TransformInterceptor` normalizes it into `{ message, data, pagination? }`.

- `message` defaults to `"OK"` when a handler returns a bare value; controllers set `"Created"` on `POST`s.
- `data` is the resource (object for single, array for list, `null` for deletes).
- `pagination` is present only on paginated list endpoints, and carries the keys listed under [Pagination](#pagination).
- **`request_id` appears on errors only** — it is not part of the success envelope.

The **error** envelope (from `AllExceptionsFilter`) is always `{ "message": "…", "data": null, "request_id": "…" }` with the thrown `HttpException`'s status. `class-validator` failures (arrays of messages) are **flattened to a single string** joined by `"; "`. Non-Nest errors carrying an http-errors `status`/`statusCode` (e.g. body-parser `PayloadTooLargeError`) surface that real status instead of collapsing to 500; in production, non-`HttpException` messages are replaced with the generic status text.

Prisma's `P2025` ("record not found", thrown by `update`/`delete` against a missing row) is mapped to `404 "Not found"` by `src/core/filters/all-exceptions.filter.ts` before the generic non-`HttpException` handling runs, so services do not need an existence check purely to produce a 404.

### Prisma access

`PrismaService` (in `src/core/database/`) extends `PrismaClient` and manages its lifecycle (`$connect` on `onModuleInit`, `$disconnect` on `onModuleDestroy`). Inject it into any service with `constructor(private readonly prisma: PrismaService) {}`.

The schema (`prisma/schema.prisma`) is snake_case in the DB but camelCase in the client (`@map`/`@@map`). Services translate the Prisma camelCase rows back to the **snake_case API contract** the SPA consumes (see the shared `toSnakeKeys` generic in `src/shared/utils/to-snake-keys.ts`, imported by the `invitations`, `members`, `todos`, `roles`, `permissions`, `projects`, and `orgs` services). It is shallow by design — `select` the fields you want first rather than relying on it to walk nested relations. Multi-row invariants use PostgreSQL locks inside `prisma.$transaction` — `pg_advisory_xact_lock` for the last-owner check, `SELECT … FOR UPDATE` for invitation accept, and the non-blocking `pg_try_advisory_xact_lock` for the nightly cleanup job.

### Request context

```
req.id          // Request ID (pino genReqId, from x-request-id or a fresh UUID)
req.user        // { id } — set by JwtAuthGuard (access_token) or RefreshTokenGuard (refresh_token)
req.org         // { id, role_name } from OrgGuard
req.project     // { id } from ProjectGuard
req.permissions // ["todos:create", ...] merged org + project permissions
```

### Authentication flow

- `POST /api/v1/auth/signup` → creates user, returns `{ id, name, email }` (no tokens). Backfills any pending invitations for that email (best-effort). Email required + unique; name is a display name. **Deliberate trade-off (L-14)**: signup reveals when an email is taken. Signin and forgot-password are enumeration-hardened; signup is not, because the "if an account exists we've emailed you" pattern requires real email delivery, which the template does not ship. Revisit when a mailer lands — do not "fix" this alone.
- `POST /api/v1/auth/signin` → authenticates by email + password, stores the refresh-token hash, sets `access_token` + `refresh_token` httpOnly cookies, returns `{ id, name, email }`.
- `POST /api/v1/auth/refresh` → **token rotation**: claims the old refresh token atomically (`claimForRotation` sets `revokedAt` only where still null — a read-check-revoke sequence would let two concurrent presenters both rotate), stores the new hash, sets new cookies. **Reuse detection**: the row is looked up with `findByToken` (which deliberately does _not_ filter on `revokedAt`, so a replay is distinguishable from a forgery); if the presented token is already revoked — or loses the atomic claim — every refresh token for that user is revoked, the cookies are cleared, a warning is logged, and the request gets `401 "Invalid refresh token"`.
- `POST /api/v1/auth/logout` → revokes the refresh token, clears cookies. Idempotent.
- `GET /api/v1/auth/me` → authenticated; confirms the `access_token` cookie is still valid and returns the user.
- `POST /api/v1/auth/forgot-password` → `{ email }`, always `200` with a neutral message. Unknown addresses are a silent no-op (no enumeration). Issuing a new token voids any earlier outstanding ones — the newest link is the only valid link. Delivery goes through `PasswordResetNotifierService`, whose always-on log line carries the user id (the address is PII); the reset URL is logged at `debug` **only** when `NODE_ENV === "development"`.
- `POST /api/v1/auth/reset-password` → `{ token, password, confirmation_password }`. `token` is 64 hex chars; only its SHA-256 hash is stored. Claimed atomically via `updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } } })` — 0 rows updated means `400 "Invalid or expired reset token"`. TTL is 1 hour. Success is a full credential rotation: it clears `failedLoginAttempts`/`lockedUntil`, revokes every outstanding refresh token, and voids every other outstanding reset token for that user.

Cookies: `access_token` (path `/api/v1`) and `refresh_token` (path `/api/v1/auth`) — both derived from `ACCESS_COOKIE_PATH` / `REFRESH_COOKIE_PATH` in `src/core/config/api-version.ts`, never spelled by hand; see [URI versioning](#uri-versioning). Both httpOnly, `SameSite=Strict`, `Secure` in production. `SameSite=Strict` is a **deliberate** choice (L-24): it requires the SPA and API to share a registrable domain — the shipped `app.<DOMAIN>` / `api.<DOMAIN>` topology qualifies; splitting them across registrable domains silently breaks auth, and changing it means editing `cookie.service.ts`, not an env var. `maxAge` is **derived** from `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` via `parseDuration` (`src/shared/utils/duration.ts`) rather than hard-coded, so cookie and JWT lifetimes cannot drift; `clear()` uses `maxAge: 0`. JWT pinned to HS256.

Signin hardening: every attempt runs one Argon2 verify against a real or dummy hash **before** branching on lock state, so unknown-email, wrong-password and locked paths share one timing profile; 5 failed attempts lock the account for 15 minutes (`MAX_FAILED_ATTEMPTS` / `LOCKOUT_DURATION_MS` in `auth.service.ts`).

### Multi-tenancy

**Hierarchy**: Organization → Project → Resources (Todos). Shared database, tenant columns (`org_id`, `project_id`); no schema-per-tenant. Users may belong to many orgs and many projects.

### Permissions

**RBAC**: permission-per-role. Each org gets the four system roles in `SYSTEM_ROLE_NAMES` on creation; owners may add custom roles with granular permissions. The canonical permission list and the system-role → permission map live in **`src/modules/orgs/system-roles.ts`** (`ALL_PERMISSIONS`, which is module-private, and the exported `SYSTEM_ROLE_PERMISSIONS`):

| Role   | Permissions                                                       |
| ------ | ----------------------------------------------------------------- |
| owner  | All of `ALL_PERMISSIONS`                                          |
| admin  | All except `org:delete` and `org:manage_roles`                    |
| member | `org:read`, `project:read`, `todos:*` (create/read/update/delete) |
| viewer | `org:read`, `project:read`, `todos:read`                          |

`project:read_all` ("view all projects in the organization, not only those you belong to") is the most recently added permission; owner and admin have it, member and viewer do not. It exists so cross-project visibility is a grantable permission instead of a role-name special case.

**Invariant: `ALL_PERMISSIONS` in `src/modules/orgs/system-roles.ts` and `PERMISSION_NAMES` in `prisma/seed.ts` must hold the same set of names.** Nothing enforces it: `ALL_PERMISSIONS` is not exported, `test/seed.int-spec.ts` only compares `PERMISSION_NAMES` against the seeded DB rows, and a name present in one and absent from the other compiles and seeds cleanly — it just silently fails to grant. Edit both in the same commit.

### Invitation system

Invite by email, 7-day expiry, accept/decline/revoke/resend. Tokens are hashed (SHA-256) — only the hash (`token_hash`) is stored; the raw token is returned only at create/resend so an admin can deliver the link by hand (no mail provider ships — `InvitationNotifierService` is the seam; the accept URL is built by `invitation-url.ts`).

- **Public preview**: `GET /api/v1/invitations/:invitation_id/preview?token=<64hex>` is `@Public()` — a logged-out invitee can see what they were invited to. Possession of the raw token is the only credential; `404` for both an unknown invitation and a wrong token (no enumeration). Returns `{ id, org_name, project_name, inviter_name, role_name, invitee_email, status, expires_at, is_expired, requires_signup }`.
- **Accept**: `POST /api/v1/invitations/:invitation_id/accept` is **authenticated and requires the raw token in the body** — `{ token: "<64 hex chars>" }` (`AcceptInvitationDto`). Two gates apply, in order: the service matches on `{ id: invitationId, tokenHash: hash(rawToken) }` and throws `404 "Invitation not found"` when either half is wrong (so a wrong token cannot probe which invitation ids exist), then checks ownership — the logged-in user's id/email must match `invitee_id`/`invitee_email`, else `403 "This invitation does not belong to you"`. Being the invitee is not sufficient on its own; the raw link is required too. Uses `SELECT … FOR UPDATE` inside a transaction to serialize concurrent accepts. Project invitations auto-add the user to the parent org as `viewer` if not already a member.
- **Pending-account invitations**: inviting an unregistered address is valid (no 404). Signup backfills `invitee_id` on matching pending/unexpired invitations so they appear in `GET /api/v1/invitations`.
- **Duplicate prevention**: a pending invitation for the same `(invitee_email, org_id, project_id)` scope is rejected with `400 "A pending invitation already exists for this email"`.
- **Expiry is derived, never written** — evaluated live against `expires_at`.
- **Invitation-only membership (I-9)**: there is **no** direct "add member" endpoint, by design. Membership rows are created only by accepting an invitation (or by creating the org/project). Do not add a POST-a-member route — every join must stay invitee-consented and flow through the invitation system.

### Environment validation

`src/core/config/env.validation.ts` (Joi) runs via `ConfigModule`'s `validate` hook at startup, `abortEarly: false`. JWT secrets must be ≥32 chars, must differ, and must not start with `changeme`. `RATE_LIMIT_AUTH_MAX` capped at 50. Failure throws before the app boots (fail-fast). Every variable, its default and its constraint are tabulated in [`README.md`](README.md#configuration).

Two things to know when reading env values elsewhere:

- **Duration grammar**: `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` must match `/^\d+[smhd]$/`. This is deliberately narrower than what `@nestjs/jwt` accepts (no `1w`) because the same string also feeds `parseDuration` for the cookie `maxAge` and the `refresh_tokens` row.
- **Defaults are not written back to `process.env`.** `@nestjs/config` applies Joi's defaults only to the validated object behind `ConfigService`, so any code reading `process.env.X` directly misses them. Read through `ConfigService` unless you are in a decorator argument, which is evaluated before the container exists.

`LOG_LEVEL` accepts only `error | warn | info | debug` — pino's `trace` and `fatal` are rejected. `SWAGGER_ENABLED` has a function default that resolves to `"false"` when `NODE_ENV === "production"` and `"true"` otherwise, which is why it must stay declared last in the schema (Joi resolves keys in declaration order and reads siblings off `parent`).

`.env.example` is the operator-facing template; `.env.test.example` ships valid dummy secrets so the e2e suite boots from `cp .env.test.example .env.test` unchanged. Do not copy `.env.example` for tests — its `changeme_…` secrets are rejected by validation on purpose.

### Scheduled maintenance

`src/modules/maintenance/cleanup.service.ts` runs `@Cron(CronExpression.EVERY_DAY_AT_3AM)`. It returns immediately when `CLEANUP_ENABLED === "false"`. Deletes run in bounded batches (10k rows), each in its own short transaction that takes `pg_try_advisory_xact_lock(hashtext('auth-cleanup'))` — non-blocking, so a replica that loses the lock stops its sweep instead of queueing behind the winner. The lock is transaction-scoped, so it is released between batches: two replicas may interleave batches of the same sweep, which is harmless (disjoint rows, both make progress) — the lock prevents duplicated work, not concurrent runs. Batching caps WAL volume and lock time no matter how large the first-sweep backlog is. The swept `expires_at`/`revoked_at` columns are indexed (see `schema.prisma`). Grace periods: refresh tokens and password-reset tokens 7 days, invitations 30 days. Retention is always measured from `expiresAt`/`revokedAt`, never `createdAt`, so a long-lived token is not deleted while still valid.

### Pagination

List endpoints accept a pagination DTO (`page`, `limit`, `sort_by`, `sort_order`, `search` — see `src/shared/pagination/pagination.dto.ts`) and services return `{ data, pagination }`, which the controller passes straight into the envelope. The meta shape is fixed at `{ current_page, total_pages, total_items, items_per_page, has_next_page, has_previous_page, next_page, previous_page }` (`PaginationService.buildMeta`); the SPA reads these keys verbatim, so adding, renaming or dropping one is a breaking client change. `next_page`/`previous_page` are `null`, not omitted, at the ends. Search terms are escaped for PostgreSQL `ILIKE`.

Two DTOs exist and their defaults differ deliberately. `PaginationQueryDto` defaults `limit` to **10** and backs todos (via `ListTodosDto`, which narrows `sort_by` to `updated_at | title`). `ListQueryDto` extends it and defaults `limit` to **50**, backing org members, project members, and org invitations — those render whole-list UIs in the SPA that send no query params, so page 1 must hold a typical tenant. Both cap `limit` at 100. `sort_order` defaults to `desc`; `sort_by` has no default at the DTO layer, so each service resolves its own (todos falls back to `updated_at`).

## Endpoints

The full endpoint list — every method, path, and required permission — lives in
[`README.md`](README.md#api-endpoints). It is the only place that list is written down; adding or
renaming a route means editing it. Route _shape_ rules are documented here:

- **Tenancy prefixes**: org-scoped controllers mount at `orgs/:org_id/...`, project-scoped
  controllers nest under `orgs/:org_id/projects/:project_id/...`. The segment names are part of the
  contract — `OrgGuard` and `ProjectGuard` read `org_id` / `project_id` off `req.params`.
- **Two authentication origins**: `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` are
  `@Public()` with respect to `JwtAuthGuard` but gated by `RefreshTokenGuard`; the invitation
  preview route is gated only by possession of the raw token.
- Global prefix, guard composition and the `PATCH`-at-preflight rule are covered above under
  [Bootstrap](#bootstrap--global-providers) and [Guard stack](#guard-stack-auth--tenant--permission).

Adding a resource is a worked tutorial in
[`TEMPLATE_GUIDE.md`](TEMPLATE_GUIDE.md#adding-a-new-resource-step-by-step-tutorial). One thing that
tutorial cannot tell you: the OpenAPI document needs no manual step, because the `@nestjs/swagger`
CLI plugin in `nest-cli.json` (`introspectComments: true`,
`dtoFileNameSuffix: [".dto.ts", ".response.ts"]`) derives property types, optionality, and
descriptions from the source, so plain class-validator DTOs and response classes alike are
documented without `@ApiProperty()` boilerplate. There is no checked-in `openapi.json` to update —
the previous hand-maintained file was deleted precisely because it drifted.

One step it **does** require: a response class only reaches `components.schemas` if it is listed in
the `extraModels` array passed to `SwaggerModule.createDocument` in `configureApp`. Generic
interfaces erase at runtime, so a class referenced only through `Payload<T>` is invisible to the
scanner. Adding a response class without adding it there yields a document that silently omits its
schema.

## Database

- **Schema**: `prisma/schema.prisma` — the domain models (`@map`/`@@map` keep the DB snake_case). `DATABASE_URL` drives the connection. `grep '^model ' prisma/schema.prisma` for the current set.
- **Role FKs**: `OrgMember.role` and `ProjectMember.role` use `onDelete: Restrict`, not `Cascade` — deleting a role that is still assigned must not silently strip memberships. `RolesService` maps the resulting `P2003`/`P2014` to `400 "Cannot delete a role that is in use"`.
- **Migrations**: `prisma/migrations/` — `prisma migrate deploy` (prod) / `prisma migrate dev` (dev). Never automatic.
- **Seed**: `prisma/seed.ts` — idempotent upsert of the canonical permissions (`prisma db seed`), wired through `prisma.config.ts`'s `seed` field.
- **Dependency placement (deliberate)**: `prisma` and `dotenv` are **production** dependencies — the runtime image runs `prisma migrate deploy`/`prisma db seed`, and `prisma.config.ts` imports `dotenv/config` at runtime, so neither may move to `devDependencies`. `express` is a direct dependency because `bootstrap.ts` imports the `json`/`urlencoded` values from it rather than through `@nestjs/platform-express`. The auto-generated banner in `prisma.config.ts` suggesting `--save-dev` is wrong for this image — do not "fix" it.

## Testing

How to run the suites is in [`README.md`](README.md#testing). The traps:

**Three tiers, selected by filename suffix alone.** There is no exclusion list; `testPathIgnorePatterns` was removed once the suffixes carried the distinction.

| Tier        | Suffix         | Config                | `testRegex`                     | Needs              |
| ----------- | -------------- | --------------------- | ------------------------------- | ------------------ |
| Unit        | `.spec.ts`     | `test/jest-unit.json` | `\.spec\.ts$`                   | nothing external   |
| Integration | `.int-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |
| End-to-end  | `.e2e-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |

- **The two configs select disjoint sets.** `.int-spec.ts` and `.e2e-spec.ts` do not end in `.spec.ts`, so no file runs in both tiers and the two counts may be added. Renaming a spec moves it between tiers with no config edit — which is the point, and also means a mistyped suffix silently drops a file from both tiers rather than failing.
- Unit specs live beside the code they cover; integration specs mostly do too. `test/` holds the e2e specs, the shared helpers, and the two configs.
- **PostgreSQL has no automatic per-test reset.** `test/setup-e2e.ts` is a Jest `globalSetup`: it applies migrations and seeds the permissions (re-exporting `seedPermissions` from `prisma/seed.ts` so suites share one implementation) **once** per run. It also exports `truncateAll`, which each spec calls itself — a spec that omits the call leaks rows into the next one.
- **Redis _is_ reset before every test.** `test/reset-redis-state.ts` is registered as `setupFilesAfterEnv` in `test/jest-e2e.json`, so its `beforeEach` is a root hook covering every test in every suite in the tier. It calls `flushRedis`, which issues `flushdb` (not `flushall`), and `.env.test` pins the connection to **database 1** so the blast radius is exactly the data the run owns. This exists because throttle counters and BullMQ job hashes are process-external: without it a full e2e pass exceeds `RATE_LIMIT_AUTH_MAX`, which is Joi-capped at 50 and so cannot simply be raised in `.env.test`. It flushes the whole db rather than matching key patterns because a pattern list must be kept in step with two libraries' key layouts — a renamed key would stop matching and nothing would fail until an unrelated suite did.
- **Style**: boot the actual NestJS app (`test/create-test-app.ts`) and drive it with Supertest.

## Code Style

- **UUIDs**: `randomUUID()` imported from `crypto`.
- **Responses**: return `{ message, data, pagination? }`; the global `TransformInterceptor` normalizes it. Do not build responses by hand.
- **No barrel files** inside `src/` — see [No barrel files](#no-barrel-files).
- **Imports cross directories by alias**, not by `../../..` — see [Path aliases](#path-aliases).
- **`noUncheckedIndexedAccess` is on.** An indexed read is `T | undefined`; narrow it. Never silence it with a non-null `!` or an `as` cast — those turn a compile-time signal into a runtime `TypeError` at a distance from the cause.
