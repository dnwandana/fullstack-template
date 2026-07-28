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
- **Node version**: `>=24.0.0`, declared as `engines.node` in all four `package.json`s, pinned by
  a single repo-root `.nvmrc`, and matched by the `node:24-alpine` base in both Dockerfiles — all of
  which must move together. Do not add per-package `.nvmrc` files: nvm/fnm/asdf search **upward**
  from the cwd, so the root file already covers every directory, and a second copy is one more place
  to drift with nothing to detect the drift. `engineStrict: true` in `pnpm-workspace.yaml` makes it a hard install-time gate rather
  than a warning, so an older Node fails `corepack pnpm install` outright. pnpm reads that setting
  from `pnpm-workspace.yaml` **only**: the npm-era `engine-strict` key in an `.npmrc` is silently
  ignored, and `corepack pnpm config get engine-strict` reports `undefined` even when it is set
  there.
- **Build orchestration**: Turborepo (`turbo.json`; version in the root `devDependencies`)
- **Packages** (`pnpm-workspace.yaml` globs `apps/*` and `packages/*`): `apps/api`
  (`@fullstack/api` — NestJS 11 + Prisma, TypeScript → `dist/`), `apps/app` (`@fullstack/app` —
  Vue 3 + Vite + TypeScript), and `packages/contracts` (`@fullstack/contracts` — dependency-free,
  **type-only** response contracts, built with plain `tsc`, consumed by `apps/api` via
  `implements`). `apps/app` consumes it too, as `Wire<Entity>` — the same contracts the API
  `implements`, mapped `Date` → `string` because the wire format is JSON. The two apps therefore
  share one definition of every response shape, and a contract change breaks both type-checks
  rather than only the API's.

**Three contracts are not drift-protected.** `apps/api` has no response DTO class for auth or member
rows — `SafeUser` is a private alias in `auth.service` and member rows are assembled inline in
`members.service` — so `User`, `OrgMember` and `ProjectMember` exist in `packages/contracts` without
an `implements` clause binding them to anything. `Todo`, `Org`, `Project`, `Role` and the
`Invitation` family do have one, and a change to those breaks the API's build. Changing the shape of
the three unbound types breaks only the frontend, and only if the frontend happens to read the
changed field.

### Turborepo strips undeclared environment variables

`turbo.json` declares `globalEnv: ["NODE_ENV"]` plus an explicit `env` allowlist on the `build` and
`test` tasks — currently **17 entries each, identical including order**, matching the 17 keys in the
API's Joi schema one for one. The two arrays must stay identical — read both before adding a
variable. Turborepo 2.x runs tasks in strict env mode by default, which has two consequences:

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

1. `apps/api/src/core/config/env.validation.ts` — the Joi schema the API validates against at boot
2. `apps/api/.env.example` — and `/.env.example` too if the Docker stack needs it
3. both `env` arrays in `turbo.json` (`build` and `test`)
4. the table in [`apps/api/README.md`](apps/api/README.md#configuration), which is canonical

`lint`, `format` and `typecheck` declare no `env` at all — the type checkers resolve
`import.meta.env` against `apps/app/env.d.ts`, a declaration file, so no variable's *value* reaches
them. `dev` is `cache: false` and `persistent: true`, so it is never cached.

## Commands

The script list is in `package.json` and in [`README.md`](README.md#scripts). **The `:api` / `:app`
suffix rule**: every root task exists in three forms — the bare form runs `turbo run <task>` across
both packages, the suffixed forms are the same command plus `--filter=@fullstack/api` or
`--filter=@fullstack/app`. All three go **through** Turborepo, so the suffixed variants keep caching
and the task graph — they only narrow the package set. There is no raw `pnpm --filter` escape hatch
wired into the root scripts.

Caveats that have cost time:

- **`lint` rewrites files.** `apps/app`'s `lint` is `run-s lint:*`, which runs `oxlint . --fix`
  and then `eslint . --fix --cache`. `run-s` expands the glob in **`package.json` key order**, not
  alphabetically, and `lint:oxlint` is declared before `lint:eslint` — so oxlint goes first.
  Reordering the two keys reorders the run. `apps/api`'s `lint` is a read-only `oxlint .` (its
  fixing variant is the package-local `lint:fix`). A root `corepack pnpm lint` therefore mutates
  `apps/app` but not `apps/api`. Do not run it on a tree you need to keep pristine for review.
- **`format` coverage is asymmetric.** `apps/api`'s `format` is `prettier --write .`, so it *does*
  reformat `apps/api/*.md`. `apps/app`'s is `prettier --write --experimental-cli src/`, scoped to
  source. The root has no Prettier dependency at all, so root markdown and `apps/app/*.md` have no
  Prettier owner — edit them by hand, and do not "fix" them with Prettier, which only produces
  unrelated reformatting noise.
- **`typecheck` is the only thing keeping JavaScript out of `apps/app`.** `allowJs` is *absent* from
  `apps/app/tsconfig.app.json` — deleted, not set to `false` — so a stray `.js` under `src/` is not
  an error by itself: an orphan nothing imports is simply not in the program and builds fine. The
  gate fires the moment something *imports* it, as
  `TS7016: Could not find a declaration file for module './x.js'`. The enforcing command is
  `typecheck` (`vue-tsc -b --force`); `build` catches it only because `apps/app`'s `build` script is
  `vue-tsc -b && vite build`. `vite build` on its own never type-checks, so splitting that `&&` — or
  invoking Vite directly — silently removes the gate. `eslint.config.js` is the one deliberate `.js`
  left in the package; it lives at the package root, outside `src/`, and is still linted.
- **`test:api` is one of three tiers, and the root exposes only two of them.** `apps/api` sorts
  specs by filename suffix, and the two Jest configs select on that suffix alone — there is no
  hand-maintained exclusion list:

  | Tier        | Suffix         | Config                | `testRegex`                     | Needs              |
  | ----------- | -------------- | --------------------- | ------------------------------- | ------------------ |
  | Unit        | `.spec.ts`     | `test/jest-unit.json` | `\.spec\.ts$`                   | nothing external   |
  | Integration | `.int-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |
  | End-to-end  | `.e2e-spec.ts` | `test/jest-e2e.json`  | `(\.e2e-spec\|\.int-spec)\.ts$` | PostgreSQL + Redis |

  `corepack pnpm test:api` runs `jest --config test/jest-e2e.json --runInBand`, i.e. the
  integration **and** e2e tiers — it needs a reachable PostgreSQL, a reachable **Redis**, and an
  `apps/api/.env.test`. The unit-only config is not exposed at the root; run it as
  `cd apps/api && corepack pnpm test:unit`.

  Because `.int-spec.ts` and `.e2e-spec.ts` do not end in `.spec.ts`, the two configs select
  **disjoint** sets: no file runs twice and the two tiers' counts may be added. This was not always
  true — the e2e `testRegex` used to be `(\.e2e-spec|\.spec)\.ts$`, which re-ran every unit spec, so
  historical totals from before the split overlap and must not be summed.

Beyond those six task names — `dev`, `build`, `lint`, `typecheck`, `test`, `format` — package-local
scripts have no root equivalent: `apps/api` adds eleven (database, unit test, watch/coverage,
`lint:fix`, `start`), `apps/app` four (`preview`, `test:watch`, `lint:oxlint`, `lint:eslint`). Each
package's README lists them.

## Docker facts and invariants

Step-by-step build/start/migrate/redeploy procedures live in
[`README.md` → Deployment](README.md#deployment) — [First deploy](README.md#first-deploy) for
production, [Local Docker](README.md#local-docker) for the local stack, and
[Useful commands](README.md#useful-commands) for logs, status, and migrations. This section records
only the facts those commands assume.

Two compose files. Production (`docker-compose.yml`) is a three-container topology — edge nginx +
app + api, with nginx the only one publishing host ports — and it declares no volumes at all. Local
(`docker-compose.local.yml`) is app (nginx built in) + api + postgres + redis, and ships both
datastores in the stack.

**Neither datastore is in the production stack; both are in the local one.** Production points
`DATABASE_URL` and `REDIS_URL` at managed instances — Redis is as required as PostgreSQL (BullMQ has
no in-memory driver; see
[`apps/api/AGENTS.md`](apps/api/AGENTS.md#redis-and-the-notification-queue)), so it gets a managed
dependency of its own rather than a container whose loss silently drops in-flight jobs. Consequences
worth knowing:

- **Nothing orders `api` startup in production** — it has no `depends_on`, boots immediately, and
  ioredis retries `REDIS_URL` with backoff indefinitely. An unreachable managed Redis therefore
  yields a container that passes `/health/live`, reports healthy, and serves traffic while every
  queue and rate-limit write fails.
- **Hostname `redis` is a local-stack fact only.** In `docker-compose.local.yml` it is the compose
  service name and is mandatory (inside the `api` container `localhost` is the API process itself);
  in production the host is whatever the managed provider gives you, and `rediss://` is the expected
  scheme there.

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

Ships a `postgres` service (`postgres:18-alpine`, literal defaults `pg_user` / `pg_password` /
`fullstack_template`) and a `redis` service (`redis:8.8-alpine`, `redis-cli ping` healthcheck,
`redis_data` volume, `api` `depends_on` it with `condition: service_healthy`). Env comes from
`.env.local`; the values to set are listed in
[`README.md` → Local Docker](README.md#local-docker). Four constraints, each with the consequence of
violating it:

- **`DATABASE_URL` must use hostname `postgres`, and `REDIS_URL` hostname `redis`** — the compose
  service names. Inside the `api` container `localhost` is the API process itself, so a `localhost`
  host gives connection-refused at boot, not a helpful DNS error.
- **`NODE_ENV=development` is required locally.** The API sets `Secure` on auth cookies only in
  production; browsers silently drop `Secure` cookies over plain HTTP, so with `NODE_ENV=production`
  login appears to succeed and every following request is unauthenticated.
- **`down -v` wipes the `postgres_data` and `redis_data` named volumes.** Data otherwise persists
  across restarts. Conversely, PostgreSQL credentials are baked into `postgres_data` on first boot —
  changing `POSTGRES_*` later has no effect until the volume is dropped and re-initialized.
- **`postgres_data` mounts at `/var/lib/postgresql`, not `/var/lib/postgresql/data`.** PostgreSQL 18
  moved `PGDATA` to `/var/lib/postgresql/<major>/docker` and the image's `VOLUME` up one level with
  it. Mounting the pre-18 path would put the named volume on a directory the server never writes to
  and leave the real cluster on an anonymous volume that Docker discards on every container
  recreate — data loss with no error. A `postgres_data` volume initialized by 17 or earlier is also
  unreadable by 18: `initdb` runs fresh alongside the stale `data/` directory and the old rows are
  simply not there. Drop the volume and re-seed.

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
- **The `app` image is a two-package build.** `apps/app/Dockerfile` backs the `app` service in
  *both* compose files, and since `apps/app` took `@fullstack/contracts` as a workspace dependency
  it needs two things a single-package frontend image does not. Its filtered install is
  `pnpm install --filter @fullstack/app... --frozen-lockfile` — the trailing `...` is what pulls the
  workspace dependency in, and without it the `workspace:*` specifier cannot resolve. And
  `packages/contracts` must be built before `apps/app`, because it emits only `.d.ts` and `vue-tsc`
  (part of `apps/app`'s `build` script) needs those on disk. The builder stage therefore copies
  `packages/contracts` twice — its `package.json` with the other manifests to keep the install layer
  cacheable, then its sources alongside `apps/app`.
- **Routes are versioned: the API mounts everything at `/api/v1`.** In production the edge nginx
  strips only the `/api` prefix — never the `/v1` — from both the proxied path
  (`proxy_pass http://api:3000/api/`) and from `Set-Cookie` paths
  (`proxy_cookie_path /api/v1/auth /v1/auth` then `proxy_cookie_path /api/v1 /v1` — most specific
  first, because nginx applies the first matching rule). So `api.<DOMAIN>` presents `/v1/...` URLs
  while the API still mounts `/api/v1/...` unmodified, via `setGlobalPrefix(API_PREFIX, { exclude: [...] })`
  followed by `enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION })` in
  `configureApp` (`apps/api/src/bootstrap.ts`). Each `exclude` entry is an **exact** path, not a
  prefix — `"health"` alone would not cover `health/live` — and `exclude` does **not** exempt a route
  from the version segment; the health controller opts out of that separately with
  `@Controller({ path: "health", version: VERSION_NEUTRAL })`.
- **`apps/api/src/core/config/api-version.ts` and `nginx/templates/api.conf.template` must change
  together.** The first defines `API_PREFIX`, `API_VERSION`, `ACCESS_COOKIE_PATH` and
  `REFRESH_COOKIE_PATH`; nginx cannot import TypeScript, so it repeats the same two cookie paths by
  hand. Cookie paths match by whole path segments, so a version bump that misses either side logs
  every user out at their next refresh with no error raised anywhere.
- **Only `/health` is exposed through the production edge.** `nginx/templates/api.conf.template`
  uses `location = /health`, an exact match, so `api.<DOMAIN>/health/live` and `/health/ready` fall
  through to `location /`, whose `proxy_pass http://api:3000/api/` turns them into
  `/api/health/live` and `/api/health/ready` — paths that exist under neither the version prefix nor
  the prefix exclusion, so they 404. All three probes work in the local stack, where
  `nginx/local.conf` uses a prefix `location /health`. Point external orchestrator probes at the
  container, or add exact-match locations to the template.
- The edge also sets `proxy_hide_header Strict-Transport-Security` on the api vhost, so the HSTS
  header the API emits is suppressed and the edge's own `add_header` is the only copy the client
  sees. Two HSTS headers would otherwise be sent.
- Container healthchecks in both compose files are identical and probe
  `wget -qO- http://localhost:3000/health/live` from *inside* the `api` container, so they never
  traverse nginx. `/health/live` is deliberate: it is liveness, not readiness, so a database outage
  drops the instance from the traffic pool instead of making Docker restart a healthy process. Note
  the consequence for Redis: `/health/live` touches no dependency and `/health/ready` probes only
  the database, so an instance whose Redis is unreachable boots, reports healthy, and serves
  traffic — see [`apps/api/AGENTS.md`](apps/api/AGENTS.md#redis-and-the-notification-queue).
- **Migrations never run automatically** in either stack. Apply them explicitly on every
  environment; the commands are in [`README.md` → Useful commands](README.md#useful-commands).
