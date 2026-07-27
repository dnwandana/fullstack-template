# AGENTS.md

Monorepo root guidance — workspace and infrastructure only. This file records **facts and
invariants**: things that are true about the workspace and that you must not violate.

- Runnable procedures (install, configure, migrate, deploy) live in [`README.md`](README.md).
- Per-app architecture lives in [`apps/api/AGENTS.md`](apps/api/AGENTS.md#architecture) (modules,
  guards, response envelope, permissions) and
  [`apps/app/AGENTS.md`](apps/app/AGENTS.md#architecture-overview) (stores, composables, HTTP
  client).
- [`apps/api/README.md`](apps/api/README.md#configuration) is the canonical environment-variable
  reference; [`apps/api/README.md`](apps/api/README.md#api-endpoints) is the canonical endpoint
  table.

`CLAUDE.md` at every level is a symlink to the `AGENTS.md` beside it. Edit `AGENTS.md`; never
create a real `CLAUDE.md`.

Cite code by symbol and file, never `file.ts:NN` — line numbers break silently on any edit above
them, and a stale one that lands on plausible code misleads instead of announcing itself.

## Workspace

- **Package manager**: pnpm via Corepack, version pinned by the root `package.json`'s
  `packageManager` field — always invoke as `corepack pnpm <script>`, never `npm`, never `yarn`,
  and never with a `run` in the middle.
- **Build orchestration**: Turborepo (`turbo.json`; version in the root `devDependencies`)
- **Packages**: `apps/api` (`@fullstack/api` — NestJS 11 + Prisma, TypeScript → `dist/`),
  `apps/app` (`@fullstack/app` — Vue 3 + Vite)

### Turborepo strips undeclared environment variables

`turbo.json` declares `globalEnv: ["NODE_ENV"]` plus an explicit `env` allowlist on the `build` and
`test` tasks. The two arrays must stay identical — read both before adding a variable. Turborepo 2.x
runs tasks in strict env mode by default, which has two consequences:

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
4. the table in [`apps/api/README.md`](apps/api/README.md#configuration), which is canonical

`lint` and `format` declare no `env` at all; `dev` is `cache: false` and `persistent: true`, so it is
never cached.

## Commands

The script list is in `package.json` and in [`README.md`](README.md#scripts). **The `:api` / `:app`
suffix rule**: every root task exists in three forms — the bare form runs `turbo run <task>` across
both packages, the suffixed forms are the same command plus `--filter=@fullstack/api` or
`--filter=@fullstack/app`. All three go **through** Turborepo, so the suffixed variants keep caching
and the task graph — they only narrow the package set. There is no raw `pnpm --filter` escape hatch
wired into the root scripts.

Caveats that have cost time:

- **`lint` rewrites files.** `apps/app`'s `lint` is `run-s lint:*`, which runs `eslint . --fix --cache`
  and `oxlint . --fix` (the glob expands alphabetically, so eslint goes first). `apps/api`'s `lint` is
  a read-only `oxlint .` (its fixing variant is the package-local `lint:fix`). A root
  `corepack pnpm lint` therefore mutates `apps/app` but not `apps/api`. Do not run it on a tree you
  need to keep pristine for review.
- **`format` coverage is asymmetric.** `apps/api`'s `format` is `prettier --write .`, so it *does*
  reformat `apps/api/*.md`. `apps/app`'s is `prettier --write --experimental-cli src/`, scoped to
  source. The root has no Prettier dependency at all, so root markdown and `apps/app/*.md` have no
  Prettier owner — edit them by hand, and do not "fix" them with Prettier, which only produces
  unrelated reformatting noise.
- **`test:api` runs the whole suite, not just e2e.** `apps/api`'s `test` is
  `jest --config test/jest-e2e.json --runInBand`, and that config's `testRegex` is
  `(\.e2e-spec|\.spec)\.ts$` — unit specs included. It needs a reachable PostgreSQL and an
  `apps/api/.env.test`. The unit-only config (`test/jest-unit.json`) is not exposed at the root; run
  it as `cd apps/api && corepack pnpm test:unit`.

Beyond those five task names, package-local scripts have no root equivalent: `apps/api` adds eleven
(database, unit test, watch/coverage, `lint:fix`, `start`), `apps/app` four (`preview`,
`test:watch`, `lint:oxlint`, `lint:eslint`). Each package's README lists them.

## Docker facts and invariants

Step-by-step build/start/migrate/redeploy procedures live in
[`README.md` → Deployment](README.md#deployment) — [First deploy](README.md#first-deploy) for
production, [Local Docker](README.md#local-docker) for the local stack, and
[Useful commands](README.md#useful-commands) for logs, status, and migrations. This section records
only the facts those commands assume.

Two compose files. Production (`docker-compose.yml`) is a three-container topology — edge nginx +
app + api, with nginx the only one publishing host ports — and PostgreSQL deliberately **external**:
point `DATABASE_URL` at a managed instance. Local (`docker-compose.local.yml`) is app (nginx built
in) + api + postgres, and ships PostgreSQL in the stack.

### Production (`docker-compose.yml`)

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

### Local (`docker-compose.local.yml`)

Ships a `postgres` service (`postgres:17-alpine`, literal defaults `pg_user` / `pg_password` /
`fullstack_template`). Env comes from `.env.local`; the values to set are listed in
[`README.md` → Local Docker](README.md#local-docker). Three constraints, each with the consequence
of violating it:

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

### Common facts

- `app` container: in production its nginx (`apps/app/nginx.conf`, baked into the image) serves the
  built Vue static files **only** — it does no `/api` proxying, because the edge nginx routes
  `api.<DOMAIN>` straight to the `api` container. In local dev `nginx/local.conf` is mounted over
  that file and *does* proxy `/api` and `/health`, since the local stack is single-origin.
- In production the edge nginx strips the `/api` prefix from both the proxied path
  (`proxy_pass http://api:3000/api/`) and from `Set-Cookie` paths (`proxy_cookie_path /api/auth /auth`
  then `proxy_cookie_path /api /` — most specific first, because nginx applies the first matching
  rule). So `api.<DOMAIN>` presents clean URLs while the API still mounts routes at `/api`
  unmodified via the `setGlobalPrefix("api", { exclude: [...] })` call in `configureApp`
  (`apps/api/src/bootstrap.ts`). Each `exclude` entry is an **exact** path, not a prefix —
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
