# NestJS API Template

A production-ready RESTful API template built with NestJS 11, featuring PostgreSQL via Prisma, JWT authentication over httpOnly cookies, and a multi-tenant architecture with organization-based access control. Designed to jumpstart your next Node.js API project.

## Monorepo Usage

This package lives at `apps/api` inside the monorepo.

From the repository root, run:

```bash
corepack pnpm dev:api
corepack pnpm build:api
corepack pnpm lint:api
corepack pnpm test:api
```

You can still run package-local commands from `apps/api` with `pnpm`.

## Features

### Authentication & Security

- **JWT Authentication**: Dual-token system with access tokens (15min) and refresh tokens (7 days), pinned to HS256, delivered as httpOnly cookies
- **Password Hashing**: Argon2 for secure password storage
- **Password Complexity**: Requires uppercase, lowercase, digit, and special character
- **Account Lockout**: 5 failed login attempts locks the account for 15 minutes
- **Security Headers**: Helmet with strict Content Security Policy, referrer protection, and HSTS (1-year max-age with preload)
- **CORS**: Configurable allowed origins with credentials support for cookie-based auth
- **Rate Limiting**: Configurable global rate limit via `@nestjs/throttler` (`/health` exempt)
- **Input Validation**: `class-validator` DTOs with a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); ILIKE wildcard sanitization on search
- **Environment Validation**: Startup checks (Joi) for required variables, secret strength, and placeholder detection — fail-fast before boot
- **Body Size Limits**: 100kb cap on JSON and URL-encoded payloads
- **Request ID Validation**: Incoming `X-Request-Id` headers validated as proper UUIDs (rejects malformed input)
- **Pagination & Search**: Reusable list DTO (page, limit, sort, search) with case-insensitive, sanitized search

### Multi-Tenant Architecture

- **Organization hierarchy**: Organization → Project → Todos with shared database tenant isolation via `org_id` and `project_id` columns
- **Flexible membership**: Users can belong to multiple organizations and multiple projects (GitHub-style model)
- **Custom RBAC**: 4 built-in system roles (owner, admin, member, viewer) plus custom roles with granular permission assignment
- **16 system permissions**: covering org management, project management, invitation management, and todo operations
- **Invitation system**: Invite by email, 7-day token expiry, accept/decline/revoke/resend flow; project invitations auto-add the invitee to the parent org as a viewer. A second pending invitation for the same email in the same scope is rejected with 400. Unregistered addresses can be invited — a public, token-gated preview endpoint lets a logged-out invitee see the invitation, and signup backfills the link between the new account and any invitations already waiting for its email. Email delivery is a single documented seam (`InvitationNotifierService`); the template ships no mail provider.

### Database & Architecture

- **PostgreSQL**: Robust relational database (11 domain models)
- **Prisma**: Type-safe ORM and migration engine; the schema is snake_case in the DB (`@map`/`@@map`) and camelCase in the client
- **Modular NestJS layout**: One self-contained module per feature (`*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/`); services hold business logic and talk to Prisma, controllers stay thin
- **TypeScript**: Compiled to CommonJS (`nest build` → `dist/`)

### Observability & Reliability

- **Request ID Tracking**: Automatic `X-Request-Id` correlation across logs and responses (accepts valid UUIDs or generates one)
- **Health Check**: `GET /health` endpoint with database connectivity probe, exempt from rate limiting (production response omits uptime and database details)
- **Logging**: Structured JSON logging via `nestjs-pino` (`pino-http`) with request IDs in every log entry; `pino-pretty` in non-production

### Developer Experience

- **Standardized Responses**: Consistent success/error envelope via a global interceptor and exception filter
- **Error Handling**: Global `AllExceptionsFilter` normalizes every error into `{ message, data: null }`
- **Testing**: Jest + Supertest e2e suite booting the real app against a real PostgreSQL test database (no mocks)
- **Environment Config**: dotenv for environment-specific settings, validated at startup
- **Code Quality**: Oxlint for fast linting, Prettier for consistent formatting

## Tech Stack

| Component          | Version                          | Description                     |
| ------------------ | -------------------------------- | ------------------------------- |
| **Runtime**        | Node.js >=24.0.0                 | JavaScript runtime              |
| **Framework**      | NestJS ^11.1.28                  | Progressive Node.js framework   |
| **HTTP Platform**  | Express ^5.2.1                   | Underlying HTTP adapter         |
| **Database**       | PostgreSQL                       | Relational database             |
| **ORM**            | Prisma ^6.19.3                   | Type-safe ORM & migrations      |
| **Authentication** | @nestjs/jwt ^11.0.2, Argon2 ^0.45.1 | Token-based auth & hashing   |
| **Cookies**        | cookie-parser ^1.4.7             | httpOnly cookie management       |
| **Validation**     | class-validator ^0.15.1, Joi ^18.2.3 | DTO validation & env checks |
| **Security**       | Helmet ^8.3.0                    | Security middleware              |
| **Rate Limiting**  | @nestjs/throttler ^6.5.0         | Request throttling               |
| **Logging**        | nestjs-pino ^4.6.1, pino-http ^11.0.0 | Structured logging          |
| **Testing**        | Jest ^30.4.2, Supertest ^7.2.2   | Test runner & HTTP testing       |
| **Code Quality**   | Oxlint ^1.75.0, Prettier ^3.9.6  | Linting and formatting           |

## Prerequisites

- **Node.js** v24 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** database server ([Download](https://www.postgresql.org/download/))
- **Git** for cloning the repository

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env with your database credentials and secrets

# 3. Set up the database
npm run db:migrate   # prisma migrate deploy
npm run db:seed      # prisma db seed — 16 canonical permissions (idempotent)

# 4. Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api`

## Configuration

Create a `.env` file in the project root with the following variables:

| Variable                   | Description                          | Default                 | Required |
| -------------------------- | ------------------------------------ | ----------------------- | -------- |
| `NODE_ENV`                 | Environment mode                     | `development`           | No       |
| `PORT`                     | Server port                          | `3000`                  | No       |
| `DATABASE_URL`             | PostgreSQL connection string         | -                       | Yes      |
| `ACCESS_TOKEN_SECRET`      | Secret for access tokens             | -                       | Yes      |
| `ACCESS_TOKEN_EXPIRES_IN`  | Access token lifetime                | `15m`                   | No       |
| `REFRESH_TOKEN_SECRET`     | Secret for refresh tokens            | -                       | Yes      |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime               | `7d`                    | No       |
| `JWT_ISSUER`               | JWT issuer claim (iss)               | -                       | Yes      |
| `JWT_AUDIENCE`             | JWT audience claim (aud)             | -                       | Yes      |
| `LOG_LEVEL`                | Logging level                        | `info`                  | No       |
| `LOG_TO_FILE`              | Enable file logging                  | `true`                  | No       |
| `CORS_ALLOWED_ORIGINS`     | Comma-separated allowed origins      | `http://localhost:8080` | No       |
| `APP_BASE_URL`             | Public SPA origin for invite links   | `http://localhost:8080` | No\*     |
| `RATE_LIMIT_AUTH_MAX`      | Auth endpoint rate limit (per 15min) | `10`                    | No       |
| `RATE_LIMIT_GENERAL_MAX`   | Global rate limit (per 15min)        | `100`                   | No       |

\* `APP_BASE_URL` has a default, but the default is only correct for local development. It is the base of every invitation accept link (`<APP_BASE_URL>/invite/:invitation_id?token=…`), so leaving it unset in production produces links pointing at `localhost`. Set it to `https://app.<DOMAIN>` in production and `http://localhost` for the local Docker stack. See [`docs/invitation-flow.md`](../../docs/invitation-flow.md).

**Example DATABASE_URL:**

```
postgresql://username:password@localhost:5432/database_name
```

**Security Note:** JWT secrets must be at least 32 characters, must differ from each other, and must not contain placeholder values like "changeme". The server validates all required environment variables at startup and will refuse to start with missing, weak, or placeholder secrets. Generate secrets with:

```bash
openssl rand -hex 32
```

## Logging

This template uses `nestjs-pino` (`pino-http`) for structured, low-overhead logging:

### Features

- **Structured Logging**: JSON-formatted logs for easy parsing and analysis
- **Request Correlation**: Every log line carries the request ID derived from `X-Request-Id` (or a generated UUID)
- **Pretty Output in Dev**: `pino-pretty` formats logs for readability outside production
- **Log Levels**: standard pino levels — `error`, `warn`, `info`, `debug`, `trace`

### Log Levels

Set the `LOG_LEVEL` environment variable to control logging verbosity:

| Level   | Description                        |
| ------- | ---------------------------------- |
| `error` | Error messages only                |
| `warn`  | Warnings and errors                |
| `info`  | Informational messages (default)   |
| `debug` | Debug information (verbose output) |
| `trace` | Most verbose                       |

## Pagination & Search

List endpoints accept a list DTO (e.g. `ListTodosDto` under `src/todos/dto/`) with `page`, `limit`, `sort_by`, `sort_order`, and `search`. Services return `{ data, pagination }`, which the controller passes straight into the response envelope.

### Query Parameters

| Parameter    | Type    | Default      | Description                                   |
| ------------ | ------- | ------------ | --------------------------------------------- |
| `page`       | integer | `1`          | Page number (1-indexed)                       |
| `limit`      | integer | `10`         | Items per page (max 100)                      |
| `sort_by`    | string  | first column | Column to sort by (configurable per resource) |
| `sort_order` | string  | `desc`       | Sort direction (`asc` or `desc`)              |
| `search`     | string  | `""`         | Case-insensitive search term (max 255 chars)  |

### Example Request

```
GET /api/orgs/:org_id/projects/:project_id/todos?page=1&limit=20&sort_by=title&sort_order=asc&search=groceries
```

### Response Format

```json
{
  "message": "OK",
  "data": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 100,
    "items_per_page": 20,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  }
}
```

## Development Commands

### Server

```bash
npm run dev      # nest start --watch (dev server)
npm start        # node dist/main (production runtime)
npm run build    # nest build → dist/
```

### Testing

```bash
npm test              # Jest e2e suite (real PostgreSQL, .env.test)
npm run test:watch    # Jest in watch mode
npm run test:cov      # Jest with coverage report
```

Tests use a real PostgreSQL test database configured in `.env.test`. The setup (`test/setup-e2e.ts`) applies migrations, seeds the 16 permissions, and truncates tables between tests. Every module has an e2e spec — auth (including account lockout, cookie-based auth, token rotation), health, orgs, roles, members, projects, todos, permissions, and invitations.

### Linting & Formatting

```bash
npm run lint         # Run Oxlint (linter)
npm run lint:fix     # Auto-fix issues with Oxlint
npm run format       # Apply formatting with Prettier
```

**Note**: Run `npm run lint:fix` and `npm run format` before committing.

### Database (Prisma)

```bash
npm run db:migrate    # prisma migrate deploy (apply pending migrations)
npm run migrate:dev   # prisma migrate dev (create a new migration in dev)
npm run db:seed       # prisma db seed (16 canonical permissions, idempotent)
npm run db:generate   # prisma generate (regenerate the client after schema edits)
npm run prisma:pull   # prisma db pull (introspect the DB into schema.prisma)
```

Migrations never run automatically — apply them explicitly on every environment. The seed idempotently upserts the 16 canonical permissions; it does not populate demo data.

## API Documentation

### Health Check

| Method | Endpoint  | Description                             | Auth Required |
| ------ | --------- | --------------------------------------- | ------------- |
| GET    | `/health` | Health check with database connectivity | No            |

### Authentication Endpoints

| Method | Endpoint            | Description                                | Auth Required |
| ------ | ------------------- | ------------------------------------------ | ------------- |
| POST   | `/api/auth/signup`  | Create new user account                    | No            |
| POST   | `/api/auth/signin`  | Sign in; server sets httpOnly auth cookies | No            |
| GET    | `/api/auth/me`      | Verify cookie validity, return user        | Access Token  |
| POST   | `/api/auth/refresh` | Rotate tokens via httpOnly cookie          | Refresh Token |
| POST   | `/api/auth/logout`  | Revoke refresh token, clear cookies        | Refresh Token |

### Organization Endpoints

| Method | Endpoint            | Description      | Auth Required |
| ------ | ------------------- | ---------------- | ------------- |
| POST   | `/api/orgs`         | Create org       | Access Token  |
| GET    | `/api/orgs`         | List user's orgs | Access Token  |
| GET    | `/api/orgs/:org_id` | Get org details  | Access Token  |
| PUT    | `/api/orgs/:org_id` | Update org       | Access Token  |
| DELETE | `/api/orgs/:org_id` | Delete org       | Access Token  |

### Project Endpoints (nested under org)

| Method | Endpoint                                 | Description    | Auth Required |
| ------ | ---------------------------------------- | -------------- | ------------- |
| POST   | `/api/orgs/:org_id/projects`             | Create project | Access Token  |
| GET    | `/api/orgs/:org_id/projects`             | List projects  | Access Token  |
| GET    | `/api/orgs/:org_id/projects/:project_id` | Get project    | Access Token  |
| PUT    | `/api/orgs/:org_id/projects/:project_id` | Update project | Access Token  |
| DELETE | `/api/orgs/:org_id/projects/:project_id` | Delete project | Access Token  |

### Todo Endpoints (nested under project)

| Method | Endpoint                                                | Description                        | Auth Required |
| ------ | ------------------------------------------------------- | ---------------------------------- | ------------- |
| POST   | `/api/orgs/:org_id/projects/:project_id/todos`          | Create todo                        | Access Token  |
| GET    | `/api/orgs/:org_id/projects/:project_id/todos`          | List todos (paginated, searchable) | Access Token  |
| GET    | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | Get todo                           | Access Token  |
| PUT    | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | Update todo                        | Access Token  |
| DELETE | `/api/orgs/:org_id/projects/:project_id/todos/:todo_id` | Delete todo                        | Access Token  |
| DELETE | `/api/orgs/:org_id/projects/:project_id/todos?ids=...`  | Bulk delete todos                  | Access Token  |

### Role Endpoints (nested under org)

| Method | Endpoint                           | Description        | Auth Required |
| ------ | ---------------------------------- | ------------------ | ------------- |
| POST   | `/api/orgs/:org_id/roles`          | Create custom role | Access Token  |
| GET    | `/api/orgs/:org_id/roles`          | List roles         | Access Token  |
| GET    | `/api/orgs/:org_id/roles/:role_id` | Get role details   | Access Token  |
| PUT    | `/api/orgs/:org_id/roles/:role_id` | Update role        | Access Token  |
| DELETE | `/api/orgs/:org_id/roles/:role_id` | Delete custom role | Access Token  |

### Organization Member Endpoints

| Method | Endpoint                             | Description        | Auth Required |
| ------ | ------------------------------------ | ------------------ | ------------- |
| GET    | `/api/orgs/:org_id/members`          | List org members   | Access Token  |
| PUT    | `/api/orgs/:org_id/members/:user_id` | Update member role | Access Token  |
| DELETE | `/api/orgs/:org_id/members/:user_id` | Remove member      | Access Token  |

### Project Member Endpoints

| Method | Endpoint                                                  | Description          | Auth Required |
| ------ | --------------------------------------------------------- | -------------------- | ------------- |
| GET    | `/api/orgs/:org_id/projects/:project_id/members`          | List project members | Access Token  |
| PUT    | `/api/orgs/:org_id/projects/:project_id/members/:user_id` | Update member role   | Access Token  |
| DELETE | `/api/orgs/:org_id/projects/:project_id/members/:user_id` | Remove member        | Access Token  |

### Invitation Endpoints

| Method | Endpoint                                              | Description                         | Auth Required       |
| ------ | ----------------------------------------------------- | ----------------------------------- | ------------------- |
| POST   | `/api/orgs/:org_id/invitations`                       | Create org invitation               | Access Token        |
| GET    | `/api/orgs/:org_id/invitations`                       | List org invitations                | Access Token        |
| DELETE | `/api/orgs/:org_id/invitations/:invitation_id`        | Revoke invitation                   | Access Token        |
| POST   | `/api/orgs/:org_id/invitations/:invitation_id/resend` | Reissue invitation (new token/link) | Access Token        |
| POST   | `/api/orgs/:org_id/projects/:project_id/invitations`  | Create project invitation           | Access Token        |
| GET    | `/api/invitations`                                    | List my pending invitations         | Access Token        |
| GET    | `/api/invitations/:invitation_id/preview?token=…`     | Preview an invitation (public)      | No — token in query |
| POST   | `/api/invitations/:invitation_id/accept`              | Accept invitation                   | Access Token        |
| POST   | `/api/invitations/:invitation_id/decline`             | Decline invitation                  | Access Token        |

### Permissions Endpoint

| Method | Endpoint           | Description                 | Auth Required |
| ------ | ------------------ | --------------------------- | ------------- |
| GET    | `/api/permissions` | List all system permissions | Access Token  |

### Authentication Format

Authentication uses **httpOnly cookies** set by the server. Tokens are never exposed to client-side JavaScript.

- **Signin**: Server sets `access_token` (httpOnly, path `/api`, 15min) and `refresh_token` (httpOnly, path `/api/auth`, 7d) cookies. The response body returns `{ id, name, email }` only — no tokens.
- **Token refresh**: The browser automatically sends the `refresh_token` cookie. Server rotates both tokens and sets new cookies. Response body is `{ data: null }`.
- **Authenticated requests**: The browser automatically sends the `access_token` cookie with every request under `/api`.
- **Logout**: Server revokes the refresh token and clears both cookies.

**Cookie properties**: `httpOnly`, `Secure` (production only), `SameSite=Strict`, scoped to appropriate paths.

## System Roles & Permissions

There are 4 built-in system roles per organization. Custom roles can be created with any combination of the 16 system permissions.

| Permission               | Owner | Admin | Member | Viewer |
| ------------------------ | ----- | ----- | ------ | ------ |
| `org:read`               | Yes   | Yes   | Yes    | Yes    |
| `org:update`             | Yes   | Yes   |        |        |
| `org:delete`             | Yes   |       |        |        |
| `org:manage_members`     | Yes   | Yes   |        |        |
| `org:manage_roles`       | Yes   |       |        |        |
| `project:create`         | Yes   | Yes   |        |        |
| `project:read`           | Yes   | Yes   | Yes    | Yes    |
| `project:update`         | Yes   | Yes   |        |        |
| `project:delete`         | Yes   | Yes   |        |        |
| `project:manage_members` | Yes   | Yes   |        |        |
| `invitations:create`     | Yes   | Yes   |        |        |
| `invitations:manage`     | Yes   | Yes   |        |        |
| `todos:create`           | Yes   | Yes   | Yes    |        |
| `todos:read`             | Yes   | Yes   | Yes    | Yes    |
| `todos:update`           | Yes   | Yes   | Yes    |        |
| `todos:delete`           | Yes   | Yes   | Yes    |        |

The canonical permission list and the system-role → permission map live in `src/orgs/system-roles.ts`; the same 16 names (with descriptions) are seeded by `prisma/seed.ts`.

## Project Structure

```
apps/api/
├── src/
│   ├── main.ts               # Entry point — creates the Nest app, calls configureApp, listens
│   ├── bootstrap.ts          # helmet/cors/cookie-parser, setGlobalPrefix("api"), pino logger
│   ├── app.module.ts         # Root module: global pipe/filter/interceptor/guards + feature modules
│   ├── prisma/               # PrismaService (Prisma client lifecycle)
│   ├── auth/                 # Signup/signin/refresh/logout, JWT, cookies, refresh-token rotation
│   ├── users/                # User lookups shared by other modules
│   ├── permissions/          # GET /api/permissions reference list
│   ├── orgs/                 # Org CRUD + system-roles.ts (per-org system roles)
│   ├── roles/                # Custom role CRUD, permission assignment
│   ├── members/              # Org + project membership listing / role changes / removal
│   ├── projects/             # Project CRUD, org-scoped
│   ├── todos/                # Example project-scoped resource, paginated
│   ├── invitations/          # Invite/preview/accept/decline/revoke/resend + notifier seam
│   ├── health/               # GET /health, outside the global prefix, throttle-skipped
│   ├── tenancy/              # OrgGuard, ProjectGuard, PermissionsGuard, MembershipService
│   ├── common/               # Envelope interceptor, exception filter, decorators, DTO helpers
│   └── config/               # env.validation.ts (Joi, fail-fast at startup)
├── prisma/
│   ├── schema.prisma         # 11 domain models (introspected from the original schema)
│   ├── migrations/           # Prisma migrations (0_init baseline + subsequent)
│   └── seed.ts               # Idempotent seed of the 16 canonical permissions
├── test/                     # Jest e2e suite (Supertest against real PostgreSQL)
├── .editorconfig             # Editor configuration
├── .env.example              # Environment variable template
├── .nvmrc                    # Node.js version (24)
├── AGENTS.md                 # AI assistant reference (CLAUDE.md symlinks to it)
├── TEMPLATE_GUIDE.md         # Guide for extending this template
├── nest-cli.json             # Nest CLI configuration
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production` in your environment
2. Use strong, random JWT secrets
3. Configure your production database URL
4. Ensure `PORT` is set (or use default 3000)

### Running Migrations

Always run migrations before starting the production server:

```bash
npm run db:migrate   # prisma migrate deploy
```

### Starting the Server

```bash
npm run build
npm start
```

### Security Considerations

- Use HTTPS in production
- JWT secrets are validated at startup (minimum 32 characters, no placeholders)
- Tokens delivered as httpOnly cookies — not accessible via JavaScript (XSS protection)
- Passwords require uppercase, lowercase, digit, and special character
- Account lockout after 5 failed login attempts (15-minute lock)
- Helmet enforces strict Content Security Policy (`default-src: 'none'`), `no-referrer` policy, and HSTS with preload
- CORS is restricted to explicit origins configured via `CORS_ALLOWED_ORIGINS`, with credentials support
- Rate limiting on the global limiter, configurable via env vars
- Request body size is capped at 100kb to prevent payload abuse
- Configure database firewall rules
- Keep dependencies updated with `npm audit`
- Never commit `.env` file to version control

## Using This Template

See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) for detailed instructions on:

- NestJS module architecture patterns
- Adding new features step-by-step
- Prisma schema, migrations, and seeding
- Authentication & authorization
- Input validation patterns
- Common recipes (pagination, sorting, filtering)
</content>
</invoke>
