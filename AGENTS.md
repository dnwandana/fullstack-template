# AGENTS.md

Monorepo root guidance. This file holds facts and invariants only. Procedures live in
[`README.md`](README.md). Per-app facts live in `apps/api/AGENTS.md` and `apps/app/AGENTS.md`.
`apps/api/README.md` is the canonical reference for environment variables and endpoints.

`CLAUDE.md` at every level is a symlink to the `AGENTS.md` beside it. Edit `AGENTS.md`. Never
create a real `CLAUDE.md`. Cite code by symbol and file, never by line number.

## Workspace

- **Package manager**: pnpm via Corepack. Always run `corepack pnpm <script>`. Never `npm`, `yarn`,
  or `pnpm run`.
- **Node `>=24.21.0`** is pinned in four places that must move together: the root `.nvmrc`,
  `engines.node` in all four `package.json`s, and the `node:24.21.0-alpine` base in both
  Dockerfiles. Do not add per-package `.nvmrc` files. `engineStrict: true` in
  `pnpm-workspace.yaml` makes the gate hard.
- **Packages**: `apps/api` (`@fullstack/api`, NestJS 12 + Prisma), `apps/app` (`@fullstack/app`,
  Vue 3 + Vite), `packages/contracts` (`@fullstack/contracts`, type-only response contracts). The
  API `implements` the contracts. The app consumes them as `Wire<Entity>` (`Date` → `string`). A
  contract change breaks both type-checks. Exception: `User`, `OrgMember`, `ProjectMember` and the
  envelope helpers bind to nothing in the API, so a change to them breaks only the app.
- **Turborepo runs tasks in strict env mode.** `turbo.json` allowlists env vars on `build` and
  `test` (two identical arrays that match the API's Zod env schema). A shell-exported var that is
  not on the list is `undefined` inside the task. A new env var touches four places:
  `apps/api/src/core/config/env.validation.ts`, `apps/api/.env.example` (and `/.env.example` if
  Docker needs it), both `env` arrays in `turbo.json`, and the table in `apps/api/README.md`.
- **`db:generate` runs first.** `dev`, `build`, `typecheck` and `test` depend on it. The Prisma
  client lands in `apps/api/src/generated/prisma` (gitignored) and is not a cache input. After a
  fresh clone, a schema edit, or a `node_modules` wipe, run `corepack pnpm db:generate` yourself.

## Commands

Root tasks: `dev`, `build`, `lint`, `typecheck`, `test`, `format`. Each has an `:api` and an `:app`
variant that filters through Turborepo. Caveats:

- **`lint` rewrites files in `apps/app`** (`oxlint --fix`, then `eslint --fix`). The `apps/api`
  `lint` is read-only.
- **`format` is asymmetric.** `apps/api` formats everything, including its markdown. `apps/app`
  formats `src/` only. Root markdown has no Prettier owner. Edit it by hand.
- **`typecheck` is the only JavaScript gate in `apps/app`.** `vite build` alone never type-checks.
  Keep the `vue-tsc -b && vite build` chain.
- **`test:api` runs integration + e2e only.** It needs PostgreSQL, Redis and `apps/api/.env.test`.
  Unit tests: `cd apps/api && corepack pnpm test:unit`. The suffix selects the tier: `.spec.ts`
  (unit), `.int-spec.ts` (integration), `.e2e-spec.ts` (e2e).

## Docker

Procedures are in [`README.md` → Deployment](README.md#deployment). Facts:

- **Production** (`docker-compose.yml`): edge nginx + app + api. No datastores, no volumes.
  `DATABASE_URL` and `REDIS_URL` point at managed services. Redis is as required as PostgreSQL.
  `api` has no `depends_on`. With Redis unreachable it boots, passes `/health/live`, and hangs on
  every queue and rate-limit write.
- **Local** (`docker-compose.local.yml`): app + api + postgres + redis. Env comes from
  `.env.local`. `DATABASE_URL` must use host `postgres` and `REDIS_URL` host `redis`.
  `NODE_ENV=development` is required, or browsers drop the `Secure` cookies over HTTP. `down -v`
  wipes both data volumes. Compose reads `POSTGRES_*` from the compose-root `.env`, not from
  `.env.local`.
- **`postgres_data` mounts at `/var/lib/postgresql`**, not `/var/lib/postgresql/data`. PostgreSQL
  18 moved `PGDATA`. The old path loses data on every container recreate, with no error.
- **TLS**: one wildcard cert pair in `certs/`: `<DOMAIN>.fullchain.pem` and `<DOMAIN>.privkey.pem`.
  Vhosts render from `nginx/templates/*.template` at container start. Only `${DOMAIN}` is
  substituted, so do not escape nginx variables.
- **`VITE_API_BASE_URL` is baked into the app image at build time.** A change needs a rebuild.
- **Routes are versioned at `/api/v1`.** The edge strips only `/api`, so `api.<DOMAIN>` presents
  `/v1/...`. `apps/api/src/core/config/api-version.ts` and `nginx/templates/api.conf.template`
  repeat the cookie paths by hand and must change together. A mismatch logs every user out silently.
- **Only `/health` is exposed through the production edge** (exact match). `/health/live` and
  `/health/ready` 404 there. Container healthchecks probe `/health/live` from inside the container.
- **Migrations never run automatically** in either stack.
