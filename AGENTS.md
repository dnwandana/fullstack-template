# AGENTS.md

Monorepo root guidance — workspace and infrastructure only. This file records **facts and
invariants**: things that are true about the workspace and that you must not violate.

- Runnable procedures (install, configure, migrate, deploy) live in [`README.md`](README.md).
- Per-app architecture lives in [`apps/api/AGENTS.md`](apps/api/AGENTS.md) and
  [`apps/app/AGENTS.md`](apps/app/AGENTS.md).

`CLAUDE.md` at every level is a symlink to the `AGENTS.md` beside it. Edit `AGENTS.md`; never
create a real `CLAUDE.md`.

## Workspace

- **Package manager**: pnpm via Corepack. Pinned by the root `package.json`'s
  `packageManager: "pnpm@11.15.1"` — always invoke as `corepack pnpm <script>`, never `npm`,
  never `yarn`, and never with a `run` in the middle.
- **Build orchestration**: Turborepo (`turbo.json`, `turbo@^2.10.5`)
- **Packages**: `apps/api` (`@fullstack/api` — NestJS 11 + Prisma, TypeScript → `dist/`),
  `apps/app` (`@fullstack/app` — Vue 3 + Vite)

### Turborepo strips undeclared environment variables

`turbo.json` declares `globalEnv: ["NODE_ENV"]` plus an explicit `env` allowlist on the `build` and
`test` tasks — the same 14 variables on each: `DATABASE_URL`, `ACCESS_TOKEN_SECRET`,
`REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `JWT_ISSUER`,
`JWT_AUDIENCE`, `NODE_ENV`, `PORT`, `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS`, `APP_BASE_URL`,
`RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_GENERAL_MAX`. Turborepo 2.x runs tasks in strict env mode by
default, which has two consequences:

- **A shell-exported variable that is not on the list is invisible inside the task.**
  `FOO=bar corepack pnpm test` does not set `FOO` for Jest. It is not "set but wrong" — it is
  `undefined`, which is why the failure reads as a missing-config error rather than a bad value.
- **The `env` list is also part of the cache key.** A variable that changes a task's output but is
  not declared lets Turborepo replay a cached result produced under a different value.

This usually does not bite, because the API reads `.env` files off disk rather than inheriting them:
`ConfigModule.forRoot({ isGlobal: true, validate })` in `apps/api/src/app.module.ts`, and
`apps/api/test/load-test-env.ts` / `test/setup-e2e.ts` load `apps/api/.env.test` with
`override: true`. Shell-only overrides are the case that breaks.

Adding a new environment variable therefore touches **three or four** places:

1. `apps/api/src/config/env.validation.ts` — the Joi schema the API validates against at boot
2. `apps/api/.env.example` — and `/.env.example` too if the Docker stack needs it
3. both `env` arrays in `turbo.json` (`build` and `test`)

`lint` and `format` declare no `env` at all; `dev` is `cache: false` and `persistent: true`, so it is
never cached.

## Root commands

```bash
corepack pnpm dev           # Start both apps (nest --watch + Vite)
corepack pnpm dev:api       # API only  (http://localhost:3000)
corepack pnpm dev:app       # App only  (http://localhost:8080)
corepack pnpm build         # Build both
corepack pnpm build:api     # API only
corepack pnpm build:app     # App only
corepack pnpm lint          # Lint both — see the caveat below, this rewrites files
corepack pnpm lint:api      # API only
corepack pnpm lint:app      # App only
corepack pnpm test          # Test both apps
corepack pnpm test:api      # Jest against a real PostgreSQL
corepack pnpm test:app      # Vitest + jsdom + @vue/test-utils
corepack pnpm format        # Prettier — see the caveat below, coverage is asymmetric
corepack pnpm format:api    # API only
corepack pnpm format:app    # App only
```

**The `:api` / `:app` suffix rule.** Every root script exists in three forms. The bare form runs
`turbo run <task>` across both packages; the suffixed forms are the same command plus
`--filter=@fullstack/api` or `--filter=@fullstack/app`. All three go **through** Turborepo, so the
suffixed variants keep caching and the task graph — they only narrow the package set. There is no
raw `pnpm --filter` escape hatch wired into the root scripts.

Caveats that have cost time:

- **`lint` rewrites files.** `apps/app`'s `lint` is `run-s lint:*`, which runs `oxlint . --fix` and
  then `eslint . --fix --cache`. `apps/api`'s `lint` is a read-only `oxlint .` (its fixing variant is
  the package-local `lint:fix`). A root `corepack pnpm lint` therefore mutates `apps/app` but not
  `apps/api`. Do not run it on a tree you need to keep pristine for review.
- **`format` coverage is asymmetric.** `apps/api`'s `format` is `prettier --write .`, so it *does*
  reformat `apps/api/*.md`. `apps/app`'s is `prettier --write --experimental-cli src/`, scoped to
  source. Root markdown and `apps/app/*.md` have no Prettier owner — edit them by hand, and do not
  "fix" them with Prettier, which only produces unrelated reformatting noise.
- **`test:api` runs the whole suite, not just e2e.** `apps/api`'s `test` is
  `jest --config test/jest-e2e.json --runInBand`, and that config's `testRegex` is
  `(\.e2e-spec|\.spec)\.ts$` — unit specs included. It needs a reachable PostgreSQL and an
  `apps/api/.env.test`. The unit-only config (`test/jest-unit.json`) is not exposed at the root; run
  it as `cd apps/api && corepack pnpm test:unit`.

Package-local scripts that have no root equivalent — `db:migrate`, `db:seed`, `db:generate`,
`test:unit`, `lint:fix` — are documented in
[`apps/api/AGENTS.md`](apps/api/AGENTS.md#commands).

## Key architectural facts

- **Auth cookies**: `access_token` and `refresh_token` — httpOnly, Secure, SameSite=Strict cookies set by the server
- **Multi-tenancy**: Shared database, tenant isolation via `org_id`/`project_id` columns
- **RBAC**: `@RequirePermission(name)` decorator enforced by `PermissionsGuard`; resolved permissions live on `req.permissions`
- **Request context**: `req.id` (request ID), `req.user`, `req.org`, `req.project`, `req.permissions`
- **Error handling**: Controllers/services throw NestJS `HttpException`s, caught by the global `AllExceptionsFilter` → `{ message, data: null, request_id }`
- **Env validation**: API fails fast at startup if required vars are missing (expected behavior)
- **Health probes**: `/health/live` (process only), `/health/ready` (database probe), `/health` (combined) — all three sit outside the `/api` prefix, are public, and skip rate limiting
- **API docs**: OpenAPI is generated at boot by `@nestjs/swagger` and served at `/api/docs`; gated by `SWAGGER_ENABLED`, which defaults to off in production. No spec file is checked in
- **Scheduled work**: `@nestjs/schedule` cron in `apps/api/src/maintenance/` prunes expired auth and invitation rows nightly, in bounded batches, each guarded by a Postgres advisory lock so replicas never duplicate work (`CLEANUP_ENABLED`)

## App-specific details

- [`apps/api/AGENTS.md`](apps/api/AGENTS.md#architecture) — modules, guards, response envelope, permissions
- [`apps/app/AGENTS.md`](apps/app/AGENTS.md#architecture-overview) — stores, composables, HTTP client
- [`apps/api/README.md`](apps/api/README.md#configuration) — the canonical environment-variable reference
- [`apps/api/README.md`](apps/api/README.md#api-endpoints) — the canonical endpoint tables

## Docker facts and invariants

Step-by-step build/start/migrate/redeploy procedures live in
[`README.md` → Deployment](README.md#deployment) — [First deploy](README.md#first-deploy) for
production, [Local Docker](README.md#local-docker) for the local stack, and
[Useful commands](README.md#useful-commands) for logs, status, and migrations. This section records
only the facts those commands assume.

Two compose files. Production (`docker-compose.yml`) is a three-container topology — edge nginx +
app + api — with PostgreSQL deliberately **external**: point `DATABASE_URL` at a managed instance.
Local (`docker-compose.local.yml`) is also three containers — app (with nginx built in) + api +
postgres — and ships PostgreSQL in the stack.

### Production (`docker-compose.yml`)

- Three services: `nginx` (edge, the only one publishing host ports — `80:80` and `443:443`), `app`
  and `api` (no `ports:` key at all, reachable only inside the compose network).
- `nginx` is a name-based virtual host router built from `nginx/Dockerfile`, which does nothing but
  delete the stock `default.conf`. It builds no application code. `app.<DOMAIN>` proxies to
  `http://app:80`, `api.<DOMAIN>` proxies to `http://api:3000/api/`.
- TLS uses a **single wildcard cert pair** in `certs/` (gitignored, bind-mounted read-only at
  `/etc/nginx/certs`) with these exact filenames: `<DOMAIN>.fullchain.pem` and
  `<DOMAIN>.privkey.pem`. Both vhosts reference the same pair, so one `*.<domain>` cert covers the
  whole stack.
- Vhost config is **rendered at container start** from `nginx/templates/*.template` by the nginx
  image's envsubst entrypoint, driven by `DOMAIN` from `.env`. Only `${DOMAIN}` is in the container
  environment, so nginx runtime variables (`$host`, `$request_uri`, `$remote_addr`, `$scheme`,
  `$proxy_add_x_forwarded_for`) survive substitution untouched — do not escape them. The templates
  are bind-mounted, not baked into the image, so a template edit takes effect on a container
  restart without a rebuild.
- `DOMAIN` is consumed only by these templates. It is not part of the API's env validation, so a
  missing or wrong `DOMAIN` fails at nginx config render or as a cert-not-found error, not at API
  boot.
- The `app` image bakes its API base URL at **build time**: `VITE_API_BASE_URL` is a Docker build
  arg (`https://api.${DOMAIN}` in production, `${VITE_API_BASE_URL:-/api}` locally) baked into the
  Vite bundle. Changing it requires a rebuild — restarting the container changes nothing.
- Startup ordering: `nginx` waits for `api` to be `service_healthy` and for `app` to be
  `service_started`.
- Env from `.env`, supplied to the `api` service only (`env_file: .env`).

### Local (`docker-compose.local.yml`)

- No separate edge container. The `app` service publishes `80:80` and bind-mounts `nginx/local.conf`
  over `/etc/nginx/conf.d/default.conf`, so the stack stays single-origin on plain HTTP with no TLS.
- Ships a `postgres` service (`postgres:17-alpine`, literal defaults `pg_user` / `pg_password` /
  `fullstack_template`). `api` waits on its healthcheck (`condition: service_healthy`), and `app`
  waits on `api`'s.

Three constraints, each with the consequence of violating it:

- **`DATABASE_URL` must use hostname `postgres`** — the compose service name. Inside the `api`
  container `localhost` is the API process itself, so a `localhost` host gives connection-refused at
  boot, not a helpful DNS error.
- **`NODE_ENV=development` is required locally.** The API sets `Secure` on auth cookies only in
  production; browsers silently drop `Secure` cookies over plain HTTP, so with `NODE_ENV=production`
  login appears to succeed and every following request is unauthenticated.
- **`down -v` wipes the `postgres_data` named volume.** Data otherwise persists across restarts.
  Conversely, PostgreSQL credentials are baked into that volume on first boot — changing
  `POSTGRES_*` later has no effect until the volume is dropped and re-initialized.

One more trap: Compose resolves `${POSTGRES_USER}` / `${POSTGRES_PASSWORD}` / `${POSTGRES_DB}` from
the shell or from a `.env` file **at the compose root** — *not* from `.env.local`, which is only
handed to the `api` container via `env_file`. Setting them in `.env.local` changes nothing and the
literal defaults stay in force. `DATABASE_URL` is a separate opaque string that Compose does not
derive from them, so the two must be kept in sync by hand.

Env comes from `.env.local` (copy from `.env.example`). Alongside `NODE_ENV=development`, set
`JWT_ISSUER` / `JWT_AUDIENCE` / `CORS_ALLOWED_ORIGINS` / `APP_BASE_URL` to `http://localhost`.

### Common facts

- `app` container: in production its nginx (`apps/app/nginx.conf`, baked into the image) serves the
  built Vue static files **only** — it does no `/api` proxying, because the edge nginx routes
  `api.<DOMAIN>` straight to the `api` container. In local dev `nginx/local.conf` is mounted over
  that file and *does* proxy `/api` and `/health`, since the local stack is single-origin.
- `api` container: NestJS on Node, runs `node dist/main`. No host port is published in either
  compose file; it is reachable only as `http://api:3000` inside the Docker network.
- In production the edge nginx strips the `/api` prefix from both the proxied path
  (`proxy_pass http://api:3000/api/`) and from `Set-Cookie` paths (`proxy_cookie_path /api/auth /auth`
  then `proxy_cookie_path /api /` — most specific first, because nginx applies the first matching
  rule). So `api.<DOMAIN>` presents clean URLs while the API still mounts routes at `/api`
  unmodified via `setGlobalPrefix("api", { exclude: ["health", "health/live", "health/ready"] })` in
  `apps/api/src/bootstrap.ts:47`. Each `exclude` entry is an **exact** path, not a prefix —
  `"health"` alone would not cover `health/live`.
- **Only `/health` is exposed through the production edge.** `nginx/templates/api.conf.template`
  uses `location = /health`, an exact match, so `api.<DOMAIN>/health/live` and `/health/ready` fall
  through to `location /` and get rewritten to `/api/health/live`, which does not exist. All three
  probes work in the local stack, where `nginx/local.conf` uses a prefix `location /health`. Point
  external orchestrator probes at the container, or add exact-match locations to the template.
- The edge also sets `proxy_hide_header Strict-Transport-Security` on the api vhost, so the HSTS
  header the API emits is suppressed and the edge's own `add_header` is the only copy the client
  sees. Two HSTS headers would otherwise be sent.
- Container healthchecks in both compose files are identical and probe
  `wget -qO- http://localhost:3000/health/live` from *inside* the `api` container, so they never
  traverse nginx. `/health/live` is deliberate: it is liveness, not readiness, so a database outage
  drops the instance from the traffic pool instead of making Docker restart a healthy process.
- **Migrations never run automatically** in either stack. Apply them explicitly on every
  environment; the commands are in [`README.md` → Useful commands](README.md#useful-commands).
