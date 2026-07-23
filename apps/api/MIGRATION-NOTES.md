# NestJS + Prisma Migration Notes

Tracks what changed, what stayed, and every deviation for human review.

## Deviations from prior behavior
- Validation error body flattened from Joi strings to a single `message` string (class-validator).

## Contract preserved
- `{ message, data, pagination? }` success envelope.
- Cookie auth: access_token (path /api), refresh_token (path /api/auth), httpOnly/SameSite=Strict/Secure-in-prod.
- `/health` outside `/api`, not rate-limited, X-Request-Id header. Confirmed at Task 11: built app booted against `.env.test` and `GET /health` returned `{"message":"healthy","data":{"status":"healthy","timestamp":...,"uptime":...,"database":"ok"}}` — matches the Express-era shape exactly.

## Open questions for human review
- `package.json#prisma.seed` (added per plan) is currently overridden by the auto-generated `prisma.config.ts` (Prisma 6.19 emits a deprecation warning: "package.json#prisma is deprecated ... overridden by prisma.config.ts"). No functional impact yet since `prisma/seed.ts` doesn't exist, but whoever adds it should also set `migrations: { seed: 'ts-node prisma/seed.ts' }` in `prisma.config.ts`, or the seed hook silently won't run.
- Task 11 (foundation gate): Nest's `LegacyRouteConverter` warns on the global prefix's wildcard route matching at boot (`Unsupported route path: "/api/*" ... Attempting to auto-convert to "/api/{*path}"`) — cosmetic (Express-style `path-to-regexp` v6 syntax vs v8), auto-converted correctly, no functional impact observed against `/health`. Worth revisiting if a later plan adds a catch-all route.

## Dependency refresh (2026-07-23)
- Bumped: prettier 3.9.5→3.9.6, oxlint 1.74→1.75, argon2 0.45.0→0.45.1, cors 2.8.5→2.8.6,
  jest 29.7→30.4.2, @types/jest 29→30. All green: 7/7 tests, lint exit 0, build ok.
- Jest 30 pulls the Rust-based `unrs-resolver` (new native resolver in `jest-resolve@30`),
  which requires a postinstall build. Added `unrs-resolver: true` to `pnpm-workspace.yaml`
  `allowBuilds` (pnpm gates build scripts by allowlist; the unresolved placeholder line
  made `pnpm install` — and therefore the pre-run deps check on `pnpm test` — exit 1).
- HELD (not upgraded), with reasons:
  - typescript 7.0.2: ts-jest 29.4.12 (latest) peer-caps `typescript <7`; adopting TS7 breaks
    the test toolchain. No stable TS 6.x exists (beta only). Stay on 5.9.3.
  - @types/node 26.1.1: runtime engine is Node >=24; keep types on the 24 line (24.13.3, latest 24.x)
    so they don't describe APIs absent at runtime.
  - prisma / @prisma/client 7.9.0: Prisma 7 is ESM-only (requires "type":"module") and mandates
    driver adapters — conflicts with this CommonJS Nest foundation. Deferred to a dedicated migration.

## Prisma schema adoption (Task 3)
- `prisma db pull` against the test DB returned 13 models: the 11 domain tables plus Knex's own bookkeeping tables `knex_migrations` and `knex_migrations_lock`. Those two were dropped from `schema.prisma` (not part of the app domain, still managed by Knex) — the checked-in schema has exactly the 11 expected models.
- Relation field names were renamed from Prisma's raw introspected identifiers (e.g. `users`, `users_invitations_invitee_idTousers`) to idiomatic camelCase (`user`, `creator`, `invitee`, `inviter`, etc.) for readability. All `@@map`/`@map` table/column names and `@relation(map: ...)` FK constraint names were preserved exactly as introspected, so the generated DDL is unchanged.
- `prisma init` (Prisma 6.19) scaffolded `prisma.config.ts` instead of the older `prisma/.env` — no `prisma/.env` was generated, so there was nothing to delete for that step.
- No column types, defaults, unique constraints, or FK actions (Cascade / NoAction / Restrict-by-omission) were changed from what Prisma introspected.
