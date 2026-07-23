# NestJS + Prisma Migration Notes

The API was rebuilt from Express 5 / Knex to **NestJS 11 / Prisma** across Plans 1–5. This file records what changed, what stayed, every intentional deviation from the old contract, and how each "verify against source" item flagged during the rebuild was resolved. The goal is that a reader who trusted the old Express behavior can find any surprise here.

## What changed (stack)

| Concern             | Before (Express)                                             | After (NestJS)                                                          |
| ------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Framework           | Express 5 (`app.js` + routers)                               | NestJS 11 (modules, controllers, providers)                             |
| ORM / DB access     | Knex query builder (`src/models/*.js`)                       | Prisma (`PrismaService`, `schema.prisma`)                               |
| Validation          | Joi (inline, per controller)                                 | class-validator DTOs + global `ValidationPipe`                          |
| JWT                 | `jsonwebtoken`                                               | `@nestjs/jwt`                                                           |
| Logging             | winston + morgan                                             | nestjs-pino (`pino-http`)                                               |
| Rate limiting       | `express-rate-limit`                                         | `@nestjs/throttler`                                                     |
| Auth enforcement    | `requireAccessToken` middleware                              | global `JwtAuthGuard` + `@Public()` opt-out                             |
| Tenant / permission | `resolveOrg`/`resolveProject`/`requirePermission` middleware | `OrgGuard` → `ProjectGuard` → `PermissionsGuard` + `@RequirePermission` |
| Response shaping    | `apiResponse()` helper                                       | global `TransformInterceptor`                                           |
| Error handling      | `errorHandler` middleware                                    | global `AllExceptionsFilter`                                            |
| Module system       | ESM (`"type": "module"`)                                     | TypeScript → **CommonJS** (`nest build` → `dist/`)                      |
| Build / run         | `node src/index.js`                                          | `nest build` → `node dist/main`; dev `nest start --watch`               |
| Migrations          | `knex migrate:latest`                                        | `prisma migrate deploy` (`prisma migrate dev` in dev)                   |
| Seed                | `knex seed:run` (9 seed files)                               | `prisma db seed` (`prisma/seed.ts`)                                     |
| Tests               | Vitest + Supertest, unit + integration                       | single **Jest e2e** suite (Supertest, real Postgres)                    |

## What stayed (contract preserved)

- **HTTP surface**: every method + path + required permission is identical (`setGlobalPrefix("api", { exclude: ["health"] })` keeps `/api/*` and `/health` exactly where they were).
- **Success envelope** `{ message, data, pagination? }` and **error envelope** `{ message, data: null }`.
- **Auth cookies**: `access_token` (path `/api`) and `refresh_token` (path `/api/auth`), httpOnly, `SameSite=Strict`, `Secure` in production. Refresh-token rotation + reuse rejection preserved.
- **RBAC model**: 4 system roles (owner/admin/member/viewer) + custom roles, 16 permissions, project permissions merge with org permissions.
- **Multi-tenant isolation**: shared DB, `org_id`/`project_id` scoping; project invitations auto-add the invitee to the org as `viewer`.
- **Argon2** password hashing; constant-time dummy verify for unknown emails; **account lockout** (5 failures → 15-minute lock).
- **Pagination meta shape**: `{ page, limit, total, totalPages }`; `ILIKE` search with escaped terms.
- **Health**: `/health` outside the prefix, not rate-limited, `x-request-id` echoed. Verified: booted `dist/main` against `.env.test` and `GET /health` returned `{"message":"healthy","data":{"status":"healthy","timestamp":…,"uptime":…,"database":"ok"}}` — matches the Express-era shape (production omits `uptime`/`database`).

## Deviations from the prior contract (+ justification)

1. **Validation errors flattened to a single string.** class-validator produces an array of messages per request; `AllExceptionsFilter.flatten()` joins them with `"; "` into `message`, matching the old single-string `{ message }` the SPA already renders. No field-keyed error map is exposed.
2. **`POST /invitations/:id/accept` no longer takes a `{ token }` body.** The Express endpoint required the raw 64-hex token in the body and compared it with `timingSafeEqual`. The NestJS endpoint is authenticated and instead authorizes by matching the logged-in user's `id`/`email` against the invitation's `invitee_id`/`invitee_email` (`403` otherwise). Rationale: acceptance already requires an authenticated session, and the invitee identity is the real credential; the raw token remains required only for the logged-out **preview**. `SELECT … FOR UPDATE` inside the transaction is preserved (see below).
3. **Role write DTO uses `permission_ids`.** The NestJS `CreateRoleDto`/`UpdateRoleDto` name the permission array `permission_ids` (UUID[]). The SPA form still models it as `permissions`; **Plan 4** added a remap in `apps/app/src/api/roles.js` (`permissions` → `permission_ids`, omitted entirely when absent) with a contract test in `roles.test.js`. This closed the one contract gap found in the Task 3 audit.
4. **`database/migrations` kept, `database/seeds` deleted.** The Prisma baseline (`0_init`) was introspected from the schema the Knex migrations produced, so they are now historical. They are retained **read-only as provenance** (zero risk, documents pre-Prisma history); the Knex seeds are removed because `prisma/seed.ts` supersedes them.
5. **Prisma field-name reconciliation.** Introspected relation fields were renamed to idiomatic camelCase (`user`, `creator`, `invitee`, `inviter`, …). All `@map`/`@@map` table/column names and `@relation(map:)` FK constraint names were preserved exactly, so generated DDL is unchanged. Services re-map camelCase Prisma rows back to the SPA's snake_case contract via `toSnake` helpers, so **API response field names are unchanged** despite the internal camelCase.

## Flagged "verify against source" items — how each was resolved

- **System-role permission map.** Resolved in `src/orgs/system-roles.ts`: `SYSTEM_ROLE_PERMISSIONS` — owner = all 16; admin = all except `org:delete`, `org:manage_roles`; member = `org:read`, `project:read`, `todos:{create,read,update,delete}`; viewer = `org:read`, `project:read`, `todos:read`. Matches the Knex `05_role_permissions.js` mapping.
- **Member / invitation message strings.** Copied verbatim from the Express controllers so client-side string matching keeps working. Notable ones now living in `members.service.ts` / `invitations.service.ts`: `"Cannot change role of the last owner"`, `"Cannot remove the last owner"`, `"You cannot change your own role"`, `"You cannot remove yourself"`, `"User is not a member of this organization"`, `"A pending invitation already exists for this email"`, `"Invitation is no longer pending"`, `"This invitation does not belong to you"`, `"You are already a member of this organization"/"…project"`.
- **Invitation accept token requirement + `FOR UPDATE`.** Resolved: the raw-token requirement on accept was **dropped** in favor of authenticated-identity ownership (deviation #2), but the concurrency guarantee was **kept** — `invitations.service.accept()` runs a raw `SELECT id FROM invitations WHERE id = $1 FOR UPDATE` inside `prisma.$transaction` before the status check, matching the Express `SELECT … FOR UPDATE` semantics so two concurrent accepts cannot both succeed. The analogous last-owner invariant in `members.service.ts` uses `pg_advisory_xact_lock(hashtext(org_id))` (cast `::text` so Prisma can deserialize the void return).

## Prisma schema adoption (Task 3)

- `prisma db pull` against the test DB returned 13 models: the 11 domain tables plus Knex's own `knex_migrations` / `knex_migrations_lock`. Those two were dropped from `schema.prisma` (Knex bookkeeping, not app domain) — the checked-in schema has exactly the 11 expected models.
- No column types, defaults, unique constraints, or FK actions (Cascade / NoAction / Restrict-by-omission) were changed from what Prisma introspected.
- `prisma init` (Prisma 6.19) scaffolded `prisma.config.ts` instead of the older `prisma/.env` — no `prisma/.env` was generated, so there was nothing to delete for that step.

## Configuration notes for human review

- `package.json#prisma.seed` is `node prisma/seed.ts` (NOT `ts-node`). `prisma` is a **runtime dependency** (not a devDependency), so `prisma db seed` and `prisma migrate deploy` both work inside the production Docker image; and Node 24 strips the seed's TypeScript types natively (the file uses only erasable syntax), so no `ts-node`/compile step is needed in prod. The entry guard uses `process.argv[1]` rather than `require.main`/`import.meta` because Node's ESM syntax-detection loads the `import`-using seed as an ES module (where `require` is undefined) while ts-jest imports it as CommonJS in tests. Prisma 6.19 emits a deprecation warning that `package.json#prisma` is overridden by `prisma.config.ts`; if `prisma db seed` stops picking up the hook, move it to `migrations: { seed: "node prisma/seed.ts" }` in `prisma.config.ts`.
- Nest's `LegacyRouteConverter` warns at boot when the global prefix builds a wildcard route (`Unsupported route path: "/api/*" … auto-convert to "/api/{*path}"`) — cosmetic (path-to-regexp v6 vs v8 syntax), auto-converted correctly, no observed functional impact. Worth revisiting if a later plan adds a catch-all route.

## Dependency refresh (2026-07-23)

- Bumped: prettier 3.9.5→3.9.6, oxlint 1.74→1.75, argon2 0.45.0→0.45.1, jest 29.7→30.4.2, @types/jest 29→30. All green. (An earlier `cors 2.8.5→2.8.6` bump predates the Express removal; `cors` is no longer a direct dependency — `@nestjs/platform-express`'s `app.enableCors()` uses it transitively, so any version movement is now lockfile-only.)
- Jest 30 pulls the Rust-based `unrs-resolver` (needs a postinstall build) — added to `pnpm-workspace.yaml` `allowBuilds` so `pnpm install` doesn't exit 1.
- HELD (not upgraded), with reasons:
  - typescript 7.0.2 — ts-jest 29.4.12 peer-caps `typescript <7`; no stable TS 6.x. Stay on 5.9.3.
  - @types/node 26.1.1 — runtime engine is Node >=24; keep types on the 24 line so they don't describe absent APIs.
  - prisma / @prisma/client 7.9.0 — Prisma 7 is ESM-only (requires `"type":"module"`) and mandates driver adapters; conflicts with this CommonJS Nest foundation. Deferred to a dedicated migration.
