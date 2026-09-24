# AGENTS.md

Facts and invariants for `apps/api`. Commands, endpoints and environment variables are in
[`README.md`](README.md).

## Scope

Multi-tenant NestJS 12 REST API: Organization → Project → Resource. PostgreSQL via Prisma 7, JWT
auth in httpOnly cookies, RBAC. CommonJS build via `nest build`. Every route is under `/api/v1`.
Health routes are outside the prefix and `VERSION_NEUTRAL`.

## Layout and imports

- `src/core/` (infrastructure) imports `shared/` only. `src/shared/` (stateless helpers) imports
  nothing. `src/tenancy/` (guard chain, `MembershipService`) imports `core/`, `shared/`.
  `src/modules/` (one feature per directory) imports `core/`, `shared/`, `tenancy/`. **A module
  must not import a sibling module's internals.** Run `ls src/modules/` for the feature list.
- **Path aliases** (`@core`, `@shared`, `@modules`, `@tenancy`, `@app`, `@test`, `@generated`)
  must agree in `tsconfig.json` and in the `moduleNameMapper` of both `test/jest-unit.json` and
  `test/jest-e2e.json`. There is no `baseUrl`.
- **`build` must stay `nest build`.** Plain `tsc` emits the alias strings verbatim, and `dist/`
  fails at startup with `MODULE_NOT_FOUND`.
- **Jest `globalSetup` files use relative imports** (`test/setup-e2e.ts`, `src/seed.ts`,
  `test/create-test-prisma.ts`). Aliases do not resolve there.
- **No barrel `index.ts` files** in `src/`. Import the file that declares the symbol.
- Import Prisma types from `@generated/prisma/client`, never from `@prisma/client`. Every import
  of `@fullstack/contracts` is `import type`.

## Request pipeline

- Global providers in `app.module.ts`: `SchemaValidationPipe` (refuses a `@Body()` or `@Query()`
  without a `schema`), `TransformInterceptor` (success envelope `{ message, data, pagination? }`),
  `AllExceptionsFilter` (error envelope `{ message, data: null, request_id }`, maps Prisma `P2025`
  to 404), `ThrottlerGuard`, then `JwtAuthGuard`.
- **Guard order is a contract**: `ThrottlerGuard` → `JwtAuthGuard` → `OrgGuard` → `ProjectGuard` →
  `PermissionsGuard`. Apply it only with `@OrgScoped(permission?)` or
  `@ProjectScoped(permission?)` from `src/tenancy/scoped.decorators.ts`, plus `@RequirePermission`
  per handler. Never hand-roll `@UseGuards`.
- `req.user` is set by `JwtAuthGuard` (access cookie) **or** `RefreshTokenGuard` (refresh cookie,
  on `/auth/refresh` and `/auth/logout`). `OrgGuard` sets `req.org` and `req.permissions`.
  `ProjectGuard` merges the project permissions into `req.permissions`.
- CORS allows only `GET, POST, PUT, DELETE`. A `PATCH` route fails at preflight.
- **Request DTOs are Zod**: `xSchema` plus `type XDto = z.infer<typeof xSchema>`, passed as
  `@Body({ schema: xSchema })`. Use `z.strictObject`. Give a body schema `.meta({ id })`. Give a
  derived schema its own id. Never give a query schema an id, or Swagger drops the parameters.
- A response class `implements` a contract from `@fullstack/contracts` and must be listed in
  `extraModels` in `configureApp`, or Swagger omits it. There is no checked-in `openapi.json`.
- Services convert camelCase Prisma rows to the snake_case wire contract with `toSnakeKeys`. It is
  shallow: `select` the fields first.
- Pagination meta keys are fixed: `current_page`, `total_pages`, `total_items`, `items_per_page`,
  `has_next_page`, `has_previous_page`, `next_page`, `previous_page`. The SPA reads them verbatim.
  `PaginationQueryDto` defaults `limit` to 10, `ListQueryDto` to 50. Both cap at 100.

## Deliberate decisions (do not "fix")

- **`OrgGuard` returns 404 for an unknown org and 403 for a non-member.** The disclosure is
  intended (L-13).
- **Signup reveals whether an email is taken** (L-14). Revisit only when a mailer ships.
- **Cookies are `SameSite=Strict`** (L-24). The SPA and the API must share a registrable domain.
- **No direct add-member endpoint** (I-9). Membership comes only from an accepted invitation.
- **Cross-project visibility keys off the `project:read_all` permission**, never a role name.
- **Audit writes are best-effort.** `AuditService.record` swallows failures. Do not wrap it, and do
  not await it inside the mutation transaction. Rows are append-only.
- `authThrottleLimit()` in `src/core/config/auth-throttle.ts` is the one config value read from
  `process.env`, because decorator arguments run before DI. Everything else reads `ConfigService`.
  Env defaults are not written back to `process.env`.
- `ALL_PERMISSIONS` (`src/modules/orgs/system-roles.ts`) and `PERMISSION_NAMES` (`src/seed.ts`)
  must hold the same set. A unit spec enforces it.
- `OrgMember.role` and `ProjectMember.role` use `onDelete: Restrict`.
- `prisma`, `dotenv` and `express` are production dependencies on purpose.

## Auth and tokens

- Cookie paths derive from `ACCESS_COOKIE_PATH` and `REFRESH_COOKIE_PATH` in
  `src/core/config/api-version.ts`. `nginx/templates/api.conf.template` repeats them by hand.
  Change both together.
- Refresh is an atomic rotation with reuse detection. A revoked token presented again revokes every
  token for that user.
- Reset and invitation tokens are 64 hex chars. Only the SHA-256 hash is stored. No mail provider
  ships. `NotificationProcessor` (BullMQ) is the seam.
- Signin runs one Argon2 verify on every attempt before it branches. Five failures lock the account
  for 15 minutes.
- Duration env vars match `/^\d+[smhd]$/` only.

## Redis

Required everywhere. `REDIS_URL` has no default. It stores the throttle counters and the BullMQ
`notifications` queue. Boot is **not** fail-fast: with Redis down the app starts, passes
`/health/live` and `/health/ready`, and hangs on each Redis write.

## Testing

| Tier        | Suffix         | Config                | Needs              |
| ----------- | -------------- | --------------------- | ------------------ |
| Unit        | `.spec.ts`     | `test/jest-unit.json` | nothing            |
| Integration | `.int-spec.ts` | `test/jest-e2e.json`  | PostgreSQL + Redis |
| End-to-end  | `.e2e-spec.ts` | `test/jest-e2e.json`  | PostgreSQL + Redis |

- Unit specs live in `__tests__/` beside the code. Integration specs live in `test/integration/`,
  e2e specs in `test/e2e/`.
- PostgreSQL has no per-test reset. Each spec calls `truncateAll` from `test/setup-e2e.ts`. Redis
  is flushed before every test (`flushdb` on database 1).
- Use `.env.test.example` for tests. The `.env.example` secrets fail validation on purpose.
- A hand-written UUID fixture needs a valid version digit. `00000000-0000-0000-0000-000000000001`
  is rejected.

## Code style

- `noUncheckedIndexedAccess` is on. Narrow the value. Never use `!` or `as`.
- Return a plain payload from a handler. Do not build the envelope by hand.
- `CleanupService` runs daily at 03:00 and needs `ScheduleModule.forRoot()`. The sweeps cut on
  `expires_at` or `revoked_at`, except `audit_logs`, which cuts on `created_at`.
