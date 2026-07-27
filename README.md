# Fullstack Template

A production-ready monorepo for building multi-tenant SaaS applications. Combines a secure NestJS REST API with a Vue 3 SPA, wired together with JWT authentication, RBAC, an invitation system, and a full Organization → Project → Resource hierarchy.

## What's inside

| Package              | Stack                                 | Purpose                                 |
| -------------------- | ------------------------------------- | --------------------------------------- |
| `apps/api`           | NestJS 11, PostgreSQL, Prisma, Redis  | REST API with auth, RBAC, multi-tenancy |
| `apps/app`           | Vue 3, Pinia, Ant Design Vue, Vite    | Single-page app consuming the API       |
| `packages/contracts` | TypeScript declarations only, no deps | Response shapes shared by API and SPA   |

## Documentation map

This file orients you and gets the stack running. Everything else is owned by a per-app doc:

| Doc                                                        | Answers                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| [`apps/api/README.md`](apps/api/README.md)                 | Run the API, endpoint tables, every environment variable    |
| [`apps/api/AGENTS.md`](apps/api/AGENTS.md)                 | How the API is built — modules, guards, envelope, structure |
| [`apps/api/TEMPLATE_GUIDE.md`](apps/api/TEMPLATE_GUIDE.md) | Extend the API — worked resource walkthrough                |
| [`apps/app/README.md`](apps/app/README.md)                 | Run the SPA                                                 |
| [`apps/app/AGENTS.md`](apps/app/AGENTS.md)                 | How the SPA is built — stores, composables, HTTP client     |
| [`apps/app/TEMPLATE_GUIDE.md`](apps/app/TEMPLATE_GUIDE.md) | Extend the SPA — worked feature walkthrough                 |
| [`AGENTS.md`](AGENTS.md)                                   | Workspace-level facts and invariants                        |

## Architecture at a glance

```
Organization
  └── Projects
        └── Todos (example resource)
```

- **Multi-tenancy**: Shared PostgreSQL database, tenant-scoped via `org_id`/`project_id` columns
- **RBAC**: 4 system roles (owner / admin / member / viewer) + custom roles, 17 granular permissions. Cross-project visibility is a permission (`project:read_all`), not a hard-coded role name
- **Auth**: Dual-token JWT via httpOnly cookies, Argon2 password hashing, password complexity, account lockout, token-based password reset, and refresh-token reuse detection
- **Invitations**: Invite by email with an accept/decline/revoke/resend flow. In short: creating an invitation issues a raw token (stored only as a hash) that expires after 7 days; the public `/invite/:id?token=…` landing page previews the invitation while logged out — possession of the raw token is the only credential; accepting requires being logged in **and** presenting that token in the request body; project invitations auto-add the invitee to the parent org as a viewer. Inviting an address with no account creates a pending-account invitation; signing up claims it. Email delivery is a single documented seam — no mail provider is shipped.

## Prerequisites

- Node.js `>=24.0.0` — declared in `apps/api/package.json` and `apps/app/package.json`; the root
  package declares no `engines`, so a version check run at the repo root enforces nothing.
- Corepack (bundled with Node 24+)
- PostgreSQL (for the API)
- Redis (for the API) — required, not optional: it backs both the rate-limit counters and the
  BullMQ notification queue, and `REDIS_URL` has no default in the API's env validation. The local
  Docker stack ships a `redis` service; the production stack does not, so production needs a managed
  Redis just as it needs a managed PostgreSQL. Running the API outside Docker means running one
  yourself.

Node 24+ is a hard floor, not a preference: `apps/api/prisma.config.ts` runs the database seed as `node prisma/seed.ts`, relying on Node's native TypeScript type-stripping (no ts-node/tsx is installed). Node ≤ 22 fails there with a confusing syntax error.

For production deployment:

- Docker Engine `>=24`
- Docker Compose `>=2.20`

## Install

```bash
corepack pnpm install
```

pnpm is pinned to `pnpm@11.15.1` by the root `package.json`'s `packageManager` field and activated
by Corepack — no global pnpm install is needed, and no other version should be used.

## Environment setup

```bash
cp .env.example .env              # Docker Compose stack (production topology)
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
```

`DATABASE_URL`, `REDIS_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_ISSUER`, and
`JWT_AUDIENCE` have no defaults — the API refuses to boot without them, and rejects the shipped `changeme_…` secrets by
design. Every variable, its default, and its validation constraint is documented in
[`apps/api/README.md`](apps/api/README.md#configuration).

## Database setup

Run Prisma migrations and (optional) seed data:

```bash
cd apps/api
corepack pnpm db:migrate   # prisma migrate deploy
corepack pnpm db:seed      # prisma db seed — inserts the 17 canonical permissions idempotently
```

Migrations never run automatically — apply them explicitly on every environment.

## Development

```bash
# Start both apps
corepack pnpm dev

# Start individually
corepack pnpm dev:api   # http://localhost:3000
corepack pnpm dev:app   # http://localhost:8080
```

## Scripts

Every root script — the full list, the `:api` / `:app` suffix rule, and the Turborepo caveats that
come with them — is documented in [`AGENTS.md`](AGENTS.md#commands).

## API overview

### Authentication endpoints

| Method | Path                                                 | Description                                                                   |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/signup`                                | Register — returns `{ id, name, email }`                                      |
| POST   | `/api/v1/auth/signin`                                | Login — sets httpOnly auth cookies, returns user info                         |
| GET    | `/api/v1/auth/me`                                    | Current session — **requires the `access_token` cookie**                      |
| POST   | `/api/v1/auth/refresh`                               | Rotate tokens — **requires the `refresh_token` cookie**                       |
| POST   | `/api/v1/auth/logout`                                | Revoke refresh token, clear cookies — **requires the `refresh_token` cookie** |
| POST   | `/api/v1/auth/forgot-password`                       | Request a reset link — always 200, never reveals whether the account exists   |
| POST   | `/api/v1/auth/reset-password`                        | Consume a single-use 64-hex reset token and set a new password                |
| GET    | `/api/v1/invitations/:invitation_id/preview?token=…` | Preview an invitation while logged out — the raw token is the only credential |

Every route not listed above is authenticated and permission-gated. The full table — path, method,
required permission, and pagination support — is in
[`apps/api/README.md`](apps/api/README.md#api-endpoints), derived from the controllers themselves.

Health checks (no auth, not rate-limited, outside both the `/api` prefix and the `/v1` version
segment — the controller is `VERSION_NEUTRAL`):

```
GET /health/live    # liveness — process only, never touches the database; always 200
GET /health/ready   # readiness — database probe; 200 ready, 503 not_ready
GET /health         # combined check; 200 healthy, 503 unhealthy
```

All three answer with the standard envelope — `{ message, data }` — where `data` is at minimum `{ status, timestamp }` and `message` mirrors `data.status` (`alive`; `ready` / `not_ready`; `healthy` / `unhealthy`). Outside production, `/health/ready` and `/health` add `uptime` and `database` (`"ok"` or `"error"`) to `data`; in production those two fields are omitted. `/health/live` never includes them — it is a fixed, dependency-free response that never touches the database. The container healthchecks in both compose files probe `/health/live` from inside the `api` container.

Note that the production edge nginx publishes health with an **exact** match (`location = /health`), so only `https://api.<DOMAIN>/health` is reachable from outside; the `live`/`ready` sub-paths are internal-only unless you widen that `location` to a prefix match. The local HTTP stack already uses a prefix match, so all three work there.

### Interactive API docs

The OpenAPI document is generated from the controllers and DTOs at boot by `@nestjs/swagger` and served at `/api/docs` (e.g. `http://localhost:3000/api/docs` in dev) — mounted straight on the Express instance, so it carries no `/v1` segment even though every route it documents does. There is no checked-in spec file to keep in sync. `SWAGGER_ENABLED` gates it and defaults to `false` when `NODE_ENV=production`.

### Response format

Success responses are `{ message, data }`, with `pagination` added on list endpoints. Errors are
`{ message, data: null, request_id }` — `request_id` appears on errors only, so a failure can always
be correlated to a log line. The envelope's fields, and how the transform interceptor and the
exception filter produce them, are documented in
[`apps/api/AGENTS.md`](apps/api/AGENTS.md#response-envelope).

### Authentication cookies

The API uses httpOnly cookies (not headers) for token management:

- `access_token` — httpOnly cookie, short-lived (default 15 min), scoped to `/api/v1`
- `refresh_token` — httpOnly cookie, long-lived (default 7 days), scoped to `/api/v1/auth`

Each cookie's lifetime is derived from `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN`, so the cookie and the JWT it carries always expire together. Both variables use the grammar `<number><s|m|h|d>` (e.g. `15m`, `7d`).

Tokens are set by the server on signin/refresh and never exposed to JavaScript. Both use `Secure` (production), `SameSite=Strict`. Refresh tokens rotate on every use, and replaying an already-revoked one revokes the user's entire refresh-token family.

### Security trade-offs

Four behaviors are deliberate design decisions, not omissions — don't "fix" them without revisiting the reasoning:

- **Org 404 vs 403** — a non-member requesting a real org gets `403`; an unknown org id gets `404`. This discloses org existence to authenticated users and is intentional (specified in the NestJS rebuild design): org ids are UUIDs, so enumeration is impractical, and the split gives a would-be member a correct error. Projects do **not** make this distinction — unknown and forbidden are both `404`.
- **Signup enumeration** — `POST /api/v1/auth/signup` says when an email is already taken. Signin and forgot-password are hardened against enumeration; signup is not, because the "if an account exists we've emailed you" pattern requires real email delivery, which the template does not ship. Revisit when a mailer lands.
- **SameSite=Strict cookies** — the SPA and API must share a registrable domain (the shipped `app.<DOMAIN>` / `api.<DOMAIN>` topology qualifies). Splitting them across registrable domains silently breaks auth; changing this means editing `cookie.service.ts`, not an env var.
- **Invitation-only membership** — there is no direct "add member" endpoint by design. Membership is created only by accepting an invitation (or by creating the org/project), so every join is invitee-consented and auditable through the invitation flow.

## Testing

```bash
corepack pnpm test        # both apps
corepack pnpm test:api    # Jest, integration + e2e tiers, against real PostgreSQL and Redis
corepack pnpm test:app    # Vitest + jsdom
```

`apps/api` splits its suites into three tiers by filename suffix. `test:api` runs only two of them
— `.int-spec.ts` and `.e2e-spec.ts`. The unit tier (`.spec.ts`) has no root script and needs no
services; run it as `cd apps/api && corepack pnpm test:unit`. The two configs select **disjoint**
sets, so their counts add up rather than overlapping.

`apps/api` needs a live PostgreSQL **and Redis**, plus a populated `apps/api/.env.test` — copy
`apps/api/.env.test.example`, which boots as-is, and point its `DATABASE_URL` at a test database.
Its `REDIS_URL` pins database 1, because the suite issues `flushdb` before every test to clear
throttle counters and queue state. Do **not** copy `.env.example` for tests: its `changeme_…`
secrets are rejected by env validation on purpose. Test layout, fixtures, and the database lifecycle
are documented in
[`apps/api/AGENTS.md`](apps/api/AGENTS.md#testing) and
[`apps/app/AGENTS.md`](apps/app/AGENTS.md#testing).

## Deployment

Production deployment uses Docker Compose with an edge nginx container as a name-based virtual host router, splitting the SPA and API onto separate subdomains (`app.<DOMAIN>`, `api.<DOMAIN>`). Three containers run on the host VM (`nginx`, `app`, `api`) and the stack declares no volumes; both datastores are external, so `DATABASE_URL` and `REDIS_URL` each point at a managed instance. Redis earns that treatment because it is not a cache the app can do without — BullMQ has no in-memory driver, so losing it means notification jobs are accepted and never run. This same-registrable-domain layout is what makes the `SameSite=Strict` auth cookies work — see [Security trade-offs](#security-trade-offs).

One consequence to plan around: the `api` service has no `depends_on` and ioredis retries indefinitely, so an unreachable Redis produces a container that boots, passes its `/health/live` healthcheck, and serves traffic while every queue and rate-limit write fails. `/health/ready` does not probe Redis either. Monitor the managed instance directly.

### How it works

```
nginx (edge, ports 80/443, name-based virtual host router)
  ├── app.<DOMAIN> → proxies to app container
  └── api.<DOMAIN> → proxies to api container, stripping the /api prefix
                      from both the request path and Set-Cookie paths

app (internal only)
  └── nginx serving the built Vue static files

api (internal only)
  ├── connects to external PostgreSQL via DATABASE_URL
  └── connects to external Redis via REDIS_URL
        └── rate-limit counters + the BullMQ notifications queue
```

### Local Docker

Test the production images locally over HTTP (no SSL required). Unlike production, the local stack ships both datastores — four containers total (`app`, `api`, `postgres`, `redis`), so nothing external is needed.

**1. Configure environment**

```bash
cp .env.example .env.local
# Edit .env.local — fill in JWT secrets, and set these local values:
#   NODE_ENV=development        ← required: keeps cookies non-Secure so browsers accept them over HTTP
#   JWT_ISSUER=http://localhost
#   JWT_AUDIENCE=http://localhost
#   CORS_ALLOWED_ORIGINS=http://localhost
#   APP_BASE_URL=http://localhost   ← base of invitation accept links
#   DATABASE_URL=postgresql://pg_user:pg_password@postgres:5432/fullstack_template
#     ← the hostname is the compose service name "postgres", not localhost
#   REDIS_URL=redis://redis:6379
#     ← likewise the compose service name "redis"; the .env.example default points
#       at a managed instance, which the local stack does not have
```

**2. Build and start**

```bash
docker compose -f docker-compose.local.yml up --build -d
```

**3. Run migrations**

```bash
docker compose -f docker-compose.local.yml run --rm api sh -c "node_modules/.bin/prisma migrate deploy"
```

App available at `http://localhost`.

**Useful commands**

```bash
docker compose -f docker-compose.local.yml logs -f        # tail all logs
docker compose -f docker-compose.local.yml logs -f api    # API logs only
docker compose -f docker-compose.local.yml ps             # container status
docker compose -f docker-compose.local.yml down           # stop and remove containers
docker compose -f docker-compose.local.yml down -v        # …and wipe the postgres_data volume
```

Database data persists across restarts in the named `postgres_data` volume; `down -v` deletes it. Production has no bundled database — point `DATABASE_URL` at a managed/external PostgreSQL instance.

**The `POSTGRES_*` interpolation trap.** The `postgres` service reads `POSTGRES_USER`,
`POSTGRES_PASSWORD`, and `POSTGRES_DB`, but `DATABASE_URL` is a separate opaque string — Compose
does not build one from the other. Changing a `POSTGRES_*` value without editing `DATABASE_URL` to
match leaves the API authenticating with the old credentials against a database that no longer
accepts them. Two details make this easy to get wrong:

- The `${POSTGRES_*}` interpolations are resolved by Compose from the shell or from a `.env` file at
  the compose root — **not** from `.env.local`, which is only handed to the `api` container via
  `env_file`. Setting `POSTGRES_PASSWORD` in `.env.local` changes nothing; the literal defaults in
  `docker-compose.local.yml` (`pg_user` / `pg_password` / `fullstack_template`) stay in force.
- The host in `DATABASE_URL` must be `postgres` — the compose service name — not `localhost`. From
  inside the `api` container, `localhost` is the API itself.

Credentials are baked into the volume on first boot, so changing them after the fact also needs
`docker compose -f docker-compose.local.yml down -v` to re-initialize the database.

### First deploy

**1. Place Let's Encrypt certificates**

A single wildcard cert pair covers both subdomains.

```bash
mkdir certs
# Copy or symlink your certs — nginx expects these exact filenames,
# prefixed with your DOMAIN value from .env:
# certs/<DOMAIN>.fullchain.pem
# certs/<DOMAIN>.privkey.pem
# Typical symlink approach (if using certbot on the host, wildcard cert for *.<domain>):
ln -s /etc/letsencrypt/live/<domain>/fullchain.pem certs/<domain>.fullchain.pem
ln -s /etc/letsencrypt/live/<domain>/privkey.pem certs/<domain>.privkey.pem
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT secrets, and DOMAIN
```

**3. Build and start**

```bash
docker compose build
docker compose up -d
```

### Re-deploy after code changes

```bash
docker compose build
docker compose up -d
```

### Useful commands

```bash
docker compose logs -f              # tail logs from every container in the stack
docker compose logs -f api          # API logs only
docker compose ps                   # container status

# Manual database migration (run before deploying schema changes)
docker compose run --rm api sh -c "node_modules/.bin/prisma migrate deploy"

# Manual seed
docker compose run --rm api sh -c "node_modules/.bin/prisma db seed"
```

### Environment variables

The stack refuses to start without these. Everything else is optional and defaulted.

| Variable               | Description                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `DOMAIN`               | Registrable domain. Production derives `app.<DOMAIN>` (SPA) and `api.<DOMAIN>` (API) from it.      |
| `DATABASE_URL`         | PostgreSQL connection string                                                                       |
| `REDIS_URL`            | Redis connection string. No default — a managed instance in production, hostname `redis` (the compose service) in the local stack |
| `ACCESS_TOKEN_SECRET`  | JWT secret, min 32 chars                                                                           |
| `REFRESH_TOKEN_SECRET` | JWT secret, min 32 chars, must differ from access secret                                           |
| `JWT_ISSUER`           | e.g. `https://api.yourdomain.com`                                                                  |
| `JWT_AUDIENCE`         | e.g. `https://api.yourdomain.com` — the audience is the API that validates the token, not the SPA  |

`DOMAIN` is consumed by the edge nginx templates, not by the API's env validation; the other six are
validated at API startup. Two more matter in production even though they are optional:
`CORS_ALLOWED_ORIGINS` must name `https://app.<DOMAIN>`, and `APP_BASE_URL` must be the public SPA
origin or invitation links point at `localhost`. The complete table — every variable, its default,
and its validation constraint — is in [`apps/api/README.md`](apps/api/README.md#configuration), and
`.env.example` is the operator-facing template.

---

## Project structure

```
fullstack-template/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts             # Entry point — creates the Nest app, calls configureApp, listens
│   │   │   ├── bootstrap.ts        # helmet/cors/cookie-parser, global prefix + URI versioning, pino, Swagger
│   │   │   ├── app.module.ts       # Root module: global pipe/filter/interceptor/guards + feature modules
│   │   │   ├── core/               # Infrastructure that owns a connection or global wiring (@core/*)
│   │   │   │   ├── config/         # env.validation.ts (Joi, fail-fast), api-version.ts, pino.config.ts
│   │   │   │   ├── database/       # PrismaService (Prisma client lifecycle)
│   │   │   │   ├── redis/          # RedisModule — the global REDIS_CLIENT ioredis provider
│   │   │   │   ├── queue/          # BullMQ notifications queue + NotificationProcessor
│   │   │   │   ├── filters/        # AllExceptionsFilter (error envelope)
│   │   │   │   └── interceptors/   # TransformInterceptor (success envelope)
│   │   │   ├── shared/             # Stateless helpers, no infrastructure of their own (@shared/*)
│   │   │   │   ├── dto/, pagination/, decorators/, validators/, utils/
│   │   │   ├── tenancy/            # Org/Project/Permissions guards + membership resolution (@tenancy/*)
│   │   │   └── modules/            # One self-contained feature module each (@modules/*)
│   │   │       └── auth, users, permissions, orgs, roles, members,
│   │   │           projects, todos, invitations, health, maintenance/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 12 domain models (@map/@@map keep the DB snake_case)
│   │   │   ├── migrations/         # Prisma migrations (single 0_init baseline)
│   │   │   └── seed.ts             # Idempotent seed of the 17 canonical permissions
│   │   └── test/                   # e2e suites + shared helpers + both Jest configs
│   │                               #   (unit and integration specs live beside the code they cover)
│   │
│   └── app/
│       └── src/
│           ├── api/                # HTTP service layer (pure fetch calls)
│           ├── stores/             # Pinia stores (state + API orchestration)
│           ├── composables/        # Bridge: stores → components
│           ├── views/              # Routed page components
│           ├── components/         # Reusable UI components
│           ├── router/             # Vue Router + auth guards
│           ├── utils/              # Fetch client, localStorage helpers
│           ├── theme/              # antd.js — design tokens fed to ConfigProvider
│           └── assets/             # app.css + design-system/ (tokens, web fonts)
│
├── packages/
│   └── contracts/                  # @fullstack/contracts — dependency-free response-shape types
│                                   #   the API `implements`; import type only, no runtime presence
│
├── package.json                    # Monorepo root
├── pnpm-workspace.yaml
└── turbo.json
```

## Adding a new resource

The recipe — module, Prisma model, tenant-scoped service, guarded controller, seeded permissions —
is a worked walkthrough in
[`apps/api/TEMPLATE_GUIDE.md`](apps/api/TEMPLATE_GUIDE.md#adding-a-new-resource-step-by-step-tutorial);
the SPA-side counterpart is [`apps/app/TEMPLATE_GUIDE.md`](apps/app/TEMPLATE_GUIDE.md#adding-new-features).

## Code style

Prettier and Oxlint, configured per package — the config files are authoritative and neither
convention is worth restating by hand.

Two things to know before running either from the root. `corepack pnpm lint` **rewrites files**: in
`apps/app` it is `run-s lint:*`, which auto-fixes with eslint and oxlint, while in `apps/api` it is
a read-only `oxlint .` (the fixing variant there is the package-local `lint:fix`). And `format`
coverage is asymmetric: `apps/api` runs `prettier --write .`, which reformats its markdown too,
whereas `apps/app` scopes Prettier to `src/`. The root has no Prettier dependency of its own, so
root markdown and `apps/app/*.md` have no formatter — edit them by hand.

The conventions that are *not* mechanically enforced are noted in
[`apps/api/AGENTS.md`](apps/api/AGENTS.md#code-style) and
[`apps/app/AGENTS.md`](apps/app/AGENTS.md#file-naming).
