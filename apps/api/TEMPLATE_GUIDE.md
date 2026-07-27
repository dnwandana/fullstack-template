# Template Guide

This guide explains how to use this NestJS API template as a starting point for your own projects. It covers the architecture, patterns, and step-by-step instructions for adding new features.

## Introduction

This template provides a production-ready foundation for building RESTful APIs with NestJS 11, PostgreSQL (via Prisma), and JWT authentication. It includes:

- Modular NestJS architecture (one module per feature)
- JWT authentication with access/refresh tokens delivered as httpOnly cookies
- Password complexity requirements and account lockout protection
- Multi-tenant RBAC (Organization → Project → Resource) enforced by guards
- A standardized success/error response envelope
- Input validation with `class-validator` DTOs and a global `ValidationPipe`
- Type-safe database access and migrations with Prisma
- Security best practices (Helmet, CORS, Argon2)
- Structured logging with `nestjs-pino`

**Who should use this guide?** Developers who want to clone this template and extend it with new features.

## Architecture Deep Dive

### Module layout

Each feature is a self-contained module under `src/<feature>/`:

```
src/<feature>/
├── <feature>.module.ts       # Wires the controller + providers, imports TenancyModule
├── <feature>.service.ts      # Business logic; injects PrismaService
├── <feature>.controller.ts   # Thin HTTP layer (params → service → envelope)
└── dto/                      # class-validator DTOs (request bodies + query params)
```

Services hold the business logic and talk to Prisma; controllers stay thin — they read request context via param decorators, call the service, and return a plain payload that the global interceptor wraps into the response envelope.

The cross-cutting providers are registered once in `src/app.module.ts`:

- `APP_PIPE` → `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — unknown body fields are rejected, DTOs are class-transformed.
- `APP_INTERCEPTOR` → `TransformInterceptor` — normalizes every response into the success envelope.
- `APP_FILTER` → `AllExceptionsFilter` — normalizes every error into the error envelope.
- `APP_GUARD` → `ThrottlerGuard` (rate limiting) then `JwtAuthGuard` (authentication).

### Guard stack (auth → tenant → permission)

Guards run in order: **global guards first, then controller-level `@UseGuards`, then handler metadata.** For a tenant-scoped route the effective order is:

1. **`ThrottlerGuard`** (global) — rate limiting.
2. **`JwtAuthGuard`** (global) — verifies the `access_token` cookie, sets `req.user = { id }`. Routes marked `@Public()` bypass it.
3. **`OrgGuard`** (applied by `@OrgScoped`/`@ProjectScoped`) — validates `org_id` is a UUID, loads the org, verifies membership, sets `req.org` + `req.permissions`. `400` invalid id, `404` unknown org, `403` non-member.
4. **`ProjectGuard`** (added by `@ProjectScoped` on nested controllers) — validates `project_id`, loads the project scoped to the org, **merges project-level permissions into the org permissions**, sets `req.project`.
5. **`PermissionsGuard`** — reads the `@RequirePermission("<name>")` metadata for the handler and throws `403` unless `req.permissions.includes(name)`.

Authorize a handler with the composite decorators from `src/tenancy/scoped.decorators.ts`: `@OrgScoped(permission?)` on `/orgs/:org_id/...` controllers, `@ProjectScoped(permission?)` on nested `/:project_id/...` controllers. Pass the permission when the whole controller shares one; otherwise apply `@RequirePermission("<name>")` per method. Read request context with the `@CurrentUser`, `@CurrentOrg`, `@CurrentProject`, and `@CurrentPermissions` param decorators.

### Response envelope

Handlers return a plain object; `TransformInterceptor` normalizes it. Controllers typically return `{ message, data, pagination? }` directly:

```typescript
return { message: "OK", data, pagination } // list
return { message: "Created", data } // POST
return { message: "OK", data: null } // delete
```

The **success** envelope:

```json
{
  "message": "OK",
  "data": {},
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 42,
    "items_per_page": 10,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  }
}
```

The **error** envelope (from `AllExceptionsFilter`) is always `{ "message": "…", "data": null, "request_id": "…" }` with the thrown `HttpException`'s status. `class-validator` failures (arrays of messages) are flattened to a single `"; "`-joined string.

### Prisma access

`PrismaService` (in `src/prisma/`) extends `PrismaClient` and manages its lifecycle (`$connect` on `onModuleInit`, `$disconnect` on `onModuleDestroy`). Inject it into any service:

```typescript
constructor(private readonly prisma: PrismaService) {}
```

The schema (`prisma/schema.prisma`) is **snake_case in the DB** but **camelCase in the client** (`@map`/`@@map`). Services translate the Prisma camelCase rows back to the **snake_case API contract** the SPA consumes via the shared `toSnakeKeys` generic in `src/common/to-snake-keys.ts` — imported by the `invitations`, `members`, `orgs`, `permissions`, `projects`, `roles`, and `todos` services. It is shallow by design: shape the row explicitly with a Prisma `select` (flattening any relations) before mapping, and `Date` values pass through untouched.

### Request context

```
req.id          // Request ID (pino genReqId, from x-request-id or a fresh UUID)
req.user        // { id } from the verified access_token JWT (JwtAuthGuard)
req.org         // { id, role_name } from OrgGuard
req.project     // { id } from ProjectGuard
req.permissions // ["todos:create", ...] merged org + project permissions
```

## Adding a New Resource: Step-by-Step Tutorial

Let's walk through adding a project-scoped **Categories** resource, mirroring the built-in `todos` module. Categories live under a project, so they follow the same tenant hierarchy: `/api/orgs/:org_id/projects/:project_id/categories`.

### Step 1: Plan the resource

**Data model** (snake_case in the DB, tenant-scoped by `project_id`):

- `id` (UUID, primary key)
- `project_id` (UUID, FK to projects — tenant scope)
- `user_id` (UUID, FK to users — creator)
- `name` (string, required)
- `color` (string, optional — hex color)
- `created_at`, `updated_at` (timestamps)

**Endpoints** (all authenticated, permission-gated):

- `GET    /api/orgs/:org_id/projects/:project_id/categories` — list (paginated)
- `POST   /api/orgs/:org_id/projects/:project_id/categories` — create
- `GET    /api/orgs/:org_id/projects/:project_id/categories/:category_id` — read
- `PUT    /api/orgs/:org_id/projects/:project_id/categories/:category_id` — update
- `DELETE /api/orgs/:org_id/projects/:project_id/categories/:category_id` — delete

### Step 2: Add the Prisma model

Add the model to `prisma/schema.prisma`. Keep the DB snake_case with `@map`/`@@map`, and scope it to a project with a cascading FK:

```prisma
model Category {
  id          String   @id @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  name        String   @db.VarChar(255)
  color       String?  @db.VarChar(32)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: NoAction)

  @@index([projectId])
  @@map("categories")
}
```

Add the back-relations on `Project` and `User` (`categories Category[]`), then create the migration and regenerate the client:

```bash
corepack pnpm migrate:dev   # prisma migrate dev — prompts for a migration name, applies it
corepack pnpm db:generate   # prisma generate — refresh the typed client
```

### Step 3: Create the DTOs

Request validation lives in `class-validator` DTOs under `src/categories/dto/`. The global `ValidationPipe` rejects unknown fields and transforms types automatically.

`src/categories/dto/category-body.dto.ts`:

```typescript
import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class CategoryBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string

  @IsOptional()
  @IsHexColor()
  color?: string
}
```

`src/categories/dto/list-categories.dto.ts` — extend the shared pagination DTO and narrow the sortable columns:

```typescript
import { IsIn, IsOptional } from "class-validator"
import { PaginationQueryDto } from "../../common/pagination/pagination.dto"

const SORTABLE = ["created_at", "name"] as const

export class ListCategoriesDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SORTABLE)
  sort_by?: (typeof SORTABLE)[number] = undefined
}
```

`PaginationQueryDto` already provides `page`, `limit`, `sort_order`, and `search` with defaults.

### Step 4: Create the service

Inject `PrismaService` and `PaginationService`. **Scope every query by `projectId`** — that is what enforces tenant isolation. Translate Prisma's camelCase rows back to the snake_case API contract with the shared `toSnakeKeys` helper — do not hand-roll a per-module converter.

`src/categories/categories.service.ts`:

```typescript
import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { PaginationService } from "../common/pagination/pagination.service"
import { toSnakeKeys } from "../common/to-snake-keys"
import { CategoryBodyDto } from "./dto/category-body.dto"
import { ListCategoriesDto } from "./dto/list-categories.dto"

const CATEGORY_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  name: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const

const SORT_COLUMN: Record<string, "createdAt" | "name"> = {
  created_at: "createdAt",
  name: "name",
}

type CategoryRow = {
  id: string
  projectId: string
  userId: string
  name: string
  color: string | null
  createdAt: Date
  updatedAt: Date
}

// Prisma's `contains` passes `%`/`_` through as live ILIKE wildcards; escape them
// (and the escape char) so search terms match literally.
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&")

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  async list(projectId: string, query: ListCategoriesDto) {
    const sortBy = query.sort_by ?? "created_at"
    const where = {
      projectId,
      ...(query.search
        ? { name: { contains: escapeLike(query.search), mode: "insensitive" as const } }
        : {}),
    }
    const totalItems = await this.prisma.category.count({ where })
    const rows = await this.prisma.category.findMany({
      where,
      select: CATEGORY_SELECT,
      orderBy: { [SORT_COLUMN[sortBy]]: query.sort_order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      data: rows.map((row) => toSnakeKeys<CategoryRow>(row)),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  async findOne(projectId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, projectId },
      select: CATEGORY_SELECT,
    })
    if (!category) throw new NotFoundException("Category not found")
    return toSnakeKeys<CategoryRow>(category)
  }

  async create(projectId: string, userId: string, dto: CategoryBodyDto) {
    const category = await this.prisma.category.create({
      data: {
        id: randomUUID(),
        projectId,
        userId,
        name: dto.name,
        color: dto.color ?? null,
      },
      select: CATEGORY_SELECT,
    })
    return toSnakeKeys<CategoryRow>(category)
  }

  async update(projectId: string, categoryId: string, dto: CategoryBodyDto) {
    // Scope by projectId as well as id — this is what blocks a cross-tenant
    // update via a foreign category id.
    const result = await this.prisma.category.updateMany({
      where: { id: categoryId, projectId },
      data: { name: dto.name, color: dto.color ?? null },
    })
    if (result.count === 0) throw new NotFoundException("Category not found")
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: CATEGORY_SELECT,
    })
    return toSnakeKeys<CategoryRow>(category)
  }

  async remove(projectId: string, categoryId: string): Promise<void> {
    await this.prisma.category.deleteMany({ where: { projectId, id: categoryId } })
  }
}
```

### Step 5: Create the controller

The controller applies the guard stack via `@ProjectScoped()`, declares the required permission per handler, and reads context with param decorators. Validate UUID path params with `ParseUUIDPipe`.

`src/categories/categories.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common"
import { CategoriesService } from "./categories.service"
import { CategoryBodyDto } from "./dto/category-body.dto"
import { ListCategoriesDto } from "./dto/list-categories.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { ProjectScoped } from "../tenancy/scoped.decorators"

@Controller("orgs/:org_id/projects/:project_id/categories")
@ProjectScoped()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission("categories:read")
  async list(@CurrentProject() project: { id: string }, @Query() query: ListCategoriesDto) {
    const { data, pagination } = await this.categories.list(project.id, query)
    return { message: "OK", data, pagination }
  }

  @Post()
  @RequirePermission("categories:create")
  async create(
    @CurrentProject() project: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: CategoryBodyDto,
  ) {
    return { message: "Created", data: await this.categories.create(project.id, userId, dto) }
  }

  @Get(":category_id")
  @RequirePermission("categories:read")
  async read(
    @CurrentProject() project: { id: string },
    @Param("category_id", ParseUUIDPipe) categoryId: string,
  ) {
    return { message: "OK", data: await this.categories.findOne(project.id, categoryId) }
  }

  @Put(":category_id")
  @RequirePermission("categories:update")
  async update(
    @CurrentProject() project: { id: string },
    @Param("category_id", ParseUUIDPipe) categoryId: string,
    @Body() dto: CategoryBodyDto,
  ) {
    return { message: "OK", data: await this.categories.update(project.id, categoryId, dto) }
  }

  @Delete(":category_id")
  @RequirePermission("categories:delete")
  async remove(
    @CurrentProject() project: { id: string },
    @Param("category_id", ParseUUIDPipe) categoryId: string,
  ) {
    await this.categories.remove(project.id, categoryId)
    return { message: "OK", data: null }
  }
}
```

### Step 6: Wire the module

`src/categories/categories.module.ts` — import `TenancyModule` (it exports the guards + `MembershipService`) and provide `PaginationService`:

```typescript
import { Module } from "@nestjs/common"
import { CategoriesService } from "./categories.service"
import { CategoriesController } from "./categories.controller"
import { TenancyModule } from "../tenancy/tenancy.module"
import { PaginationService } from "../common/pagination/pagination.service"

@Module({
  imports: [TenancyModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, PaginationService],
})
export class CategoriesModule {}
```

Then register it in `src/app.module.ts`:

```typescript
import { CategoriesModule } from "./categories/categories.module"

@Module({
  imports: [
    // ...existing feature modules
    CategoriesModule,
  ],
})
export class AppModule {}
```

> Tip: `nest g module categories`, `nest g service categories`, `nest g controller categories` scaffold these files and auto-register the module.

### Step 7: Add the permissions

New permission names must be added in **two** places so they exist in the DB and are granted to the right system roles:

1. `prisma/seed.ts` — add each name to `PERMISSION_NAMES` and a human description to `PERMISSION_DESCRIPTIONS`.
2. `src/orgs/system-roles.ts` — add each name to `ALL_PERMISSIONS`, and to the per-role lists in `SYSTEM_ROLE_PERMISSIONS` (e.g. grant `categories:read` to `viewer`/`member`, the write permissions to `member`/`admin`/`owner`).

Then re-seed (idempotent upsert):

```bash
corepack pnpm db:seed
```

### Step 8: Add an e2e test

Add a spec under `test/` that boots the app with Supertest and asserts both the envelope and each permission gate. Follow `test/todos.e2e-spec.ts` as the template — create an org (which seeds the four system roles), a project, then exercise create/read/list/update/delete and assert a `403` for a role lacking the permission.

Specs do **not** call `Test.createTestingModule(...).createNestApplication()` directly. Boot through `test/create-test-app.ts`, which applies `configureApp` from `src/bootstrap.ts` and passes `bodyParser: false` exactly as `src/main.ts` does — that flag is what makes the 100kb body limit real, so a hand-rolled app under-tests the production configuration.

Database state is the spec's responsibility. `test/setup-e2e.ts` is a Jest `globalSetup`: it applies migrations and seeds the 17 permissions **once** per run. There is no automatic per-test truncation — call the `truncateAll` it exports (and re-seed, since the truncate is `CASCADE`) from your own `beforeEach`.

The import block a new spec needs:

```typescript
import { Test } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { createTestApp } from "./create-test-app"
import { PrismaService } from "../src/prisma/prisma.service"
import { truncateAll, seedPermissions } from "./setup-e2e"
import { signupAndSignin, createOrg, getRoleId } from "./factory"

describe("Categories (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = await createTestApp(ref)
    prisma = app.get(PrismaService)
  })
  afterAll(async () => app.close())

  beforeEach(async () => {
    await truncateAll(prisma)
    await seedPermissions(prisma)
  })

  const agent = () => request(app.getHttpServer())
  // ...
})
```

```bash
corepack pnpm test   # jest --config test/jest-e2e.json (real PostgreSQL from .env.test)
```

### Step 9: Try it with cURL

```bash
# 1. Sign in — server sets httpOnly cookies
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" -c cookies.txt \
  -d '{"email":"you@example.com","password":"yourpassword"}'

# 2. Create a category (cookies sent automatically)
curl -X POST http://localhost:3000/api/orgs/ORG_ID/projects/PROJECT_ID/categories \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"name":"Work","color":"#3B82F6"}'

# 3. List categories (paginated)
curl "http://localhost:3000/api/orgs/ORG_ID/projects/PROJECT_ID/categories?page=1&limit=20" \
  -b cookies.txt
```

## Database Management

Prisma is the single source of truth for the schema and migrations.

### Workflow

```bash
corepack pnpm migrate:dev    # prisma migrate dev — create + apply a migration in dev
corepack pnpm db:migrate     # prisma migrate deploy — apply pending migrations (prod)
corepack pnpm db:generate    # prisma generate — regenerate the typed client after schema edits
corepack pnpm prisma:pull    # prisma db pull — introspect an existing DB into schema.prisma
corepack pnpm db:seed        # prisma db seed — idempotent upsert of the 17 canonical permissions
```

**Best practices:**

- Edit `prisma/schema.prisma`, then run `migrate:dev` to generate a migration under `prisma/migrations/`.
- Commit the generated migration folder — never hand-edit an already-applied migration.
- Keep DB columns snake_case via `@map`/`@@map`; the client stays camelCase.
- Migrations **never run automatically** — apply them explicitly on every environment (including Docker; see the root README).
- The seed only provisions permissions; it does not populate demo data.

## Authentication & Authorization

### Authentication flow

1. **Signup** (`POST /api/auth/signup`) — provide `name`, `email`, `password`, `confirmation_password`. Email is trimmed/lowercased and must be unique (it is the login identifier); `name` is a display name. Password is hashed with Argon2. Pending invitations for that email are backfilled (best-effort).
2. **Signin** (`POST /api/auth/signin`) — verifies email + password, stores the refresh-token hash, sets `access_token` (15min) and `refresh_token` (7d) httpOnly cookies, returns `{ id, name, email }`. After 5 failed attempts the account is locked for 15 minutes.
3. **Protected routes** — the browser sends the `access_token` cookie automatically; `JwtAuthGuard` verifies it and sets `req.user = { id }`.
4. **Refresh** (`POST /api/auth/refresh`) — rotates both tokens (revokes the old refresh token, stores the new hash) and sets new cookies.

### Making a route public

Global `JwtAuthGuard` protects everything by default. Opt a handler out with `@Public()` (see the invitation preview endpoint and the health routes, where `@Public()` sits on the controller class so all three inherit it).

### Authorizing a handler

Apply one composite decorator from `src/tenancy/scoped.decorators.ts` on the controller — `@OrgScoped(permission?)` for `/orgs/:org_id/...` routes, `@ProjectScoped(permission?)` for nested `/:project_id/...` routes — and declare the permission per method:

```typescript
import { ProjectScoped } from "../tenancy/scoped.decorators"
import { RequirePermission } from "../common/decorators/require-permission.decorator"

@Controller("orgs/:org_id/projects/:project_id/categories")
@ProjectScoped()
export class CategoriesController {
  @Post()
  @RequirePermission("categories:create")
  create(/* ... */) {}
}
```

The `permission` argument is optional: pass it (`@ProjectScoped("categories:read")`) when every handler on the controller shares one permission; leave it bare and use `@RequirePermission` per method otherwise, as `TodosController` does.

Do not hand-roll the guard list. Guard order is a contract: `ProjectGuard` reads `req.org` set by `OrgGuard`, and `PermissionsGuard` reads `req.permissions` set by both. `scoped.decorators.ts` is the only place that order is written down; composing it by hand duplicates a decision that has exactly one correct answer.

Read context with `@CurrentUser("id")`, `@CurrentOrg()`, `@CurrentProject()`, and `@CurrentPermissions()`. Project permissions merge with org permissions (deduped). Org-wide project visibility comes from the `project:read_all` permission rather than a role-name check, so any role granted it — including a custom one — sees every project in the org.

## Input Validation

Validation is declarative via `class-validator` DTOs — no manual schema calls inside handlers. The global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` rejects unknown fields and coerces types.

### Request body

```typescript
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

export class CreateWidgetDto {
  @IsString()
  @MaxLength(255)
  name!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number
}
```

### Query parameters

Extend `PaginationQueryDto` for list endpoints (it supplies `page`, `limit`, `sort_order`, `search`), and narrow `sort_by` with `@IsIn([...])` as shown in Step 3.

### Path parameters

Validate UUID params inline with `ParseUUIDPipe`:

```typescript
@Get(":widget_id")
read(@Param("widget_id", ParseUUIDPipe) widgetId: string) {}
```

A validation failure is thrown as a `400`, and `AllExceptionsFilter` flattens class-validator's message array into a single `"; "`-joined string.

## Error Handling

Throw NestJS `HttpException` subclasses from services/controllers. The global `AllExceptionsFilter` converts them to the error envelope.

```typescript
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common"

throw new BadRequestException("Invalid input")
throw new ForbiddenException("Not allowed")
throw new NotFoundException("Category not found")
```

**Error envelope** (always):

```json
{ "message": "Category not found", "data": null, "request_id": "…" }
```

- The status code is taken from the thrown exception.
- Non-Nest errors carrying an http-errors `status`/`statusCode` (e.g. body-parser `PayloadTooLargeError`) surface that real status instead of collapsing to 500.
- In production, non-`HttpException` messages are replaced with the generic status text (no leaking internals).

You do **not** write try/catch-and-`next()` blocks — unhandled throws are caught by the filter.

## API Response Format

The envelope and its error form are documented in [`AGENTS.md`](AGENTS.md#response-envelope). What matters when adding a resource: return the payload directly from the service — the interceptor wraps it — and never construct the envelope by hand.

## Common Patterns and Recipes

### Pagination

Extend `PaginationQueryDto`, then let the service do count + page fetch and hand off to `PaginationService.buildMeta` (see Step 4). The controller just forwards `{ data, pagination }` into the envelope.

### Sorting

Map the DTO's whitelisted `sort_by` (snake_case, API-facing) to the Prisma camelCase column, then pass `orderBy`:

```typescript
const SORT_COLUMN: Record<string, "createdAt" | "name"> = { created_at: "createdAt", name: "name" }
// ...
orderBy: { [SORT_COLUMN[sortBy]]: query.sort_order }
```

### Filtering / search

Build the Prisma `where` object conditionally, and **escape ILIKE wildcards** in user search terms:

```typescript
const where = {
  projectId,
  ...(query.search
    ? { name: { contains: escapeLike(query.search), mode: "insensitive" as const } }
    : {}),
}
```

### Tenant scoping (the security-critical pattern)

Every query must be scoped by `projectId` (and/or `orgId`). Guards prove the caller may access the org/project, but they do **not** tie an arbitrary resource id to that tenant — scoping the `where` clause is what prevents cross-tenant reads/writes via a foreign id. Prefer `updateMany`/`deleteMany` with a `{ id, projectId }` filter over `update`/`delete` by id alone.

### Relationships

Model FKs in `schema.prisma` with `@relation` and `onDelete: Cascade` for tenant-owned children:

```prisma
project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
```

Fetch related rows with Prisma `select`/`include` rather than hand-written joins.

## Production Considerations

### Security

1. **Environment variables** — never commit `.env`; use strong, distinct JWT secrets (≥32 chars), validated at startup by `src/config/env.validation.ts` (fail-fast).
2. **Database** — restrict the DB user's privileges, enable SSL for production connections, and keep `DATABASE_URL` out of source control.
3. **API** — rate limiting is on by default (`@nestjs/throttler`); keep dependencies patched with `corepack pnpm audit`; always serve over HTTPS in production.

### Performance

1. **Indexes** — add `@@index([...])` in `schema.prisma` for tenant columns and common filters (the `Todo` model indexes `project_id` and `[project_id, user_id]`).
2. **Query shape** — always pass an explicit `select` to avoid over-fetching; use `skip`/`take` for large result sets; avoid N+1 by using `include`/`select` on relations.
3. **Connection pooling** — configured via the `DATABASE_URL` (e.g. `?connection_limit=10`); see the Prisma docs for pool tuning.

## Troubleshooting

**"Unauthorized" / no `req.user`**

- Ensure the `access_token` httpOnly cookie is being sent (the browser does this automatically for same-site requests).
- CORS must include `credentials: true` and the frontend must use `credentials: "include"`.

**"Token expired"**

- Access tokens expire after 15 minutes; the frontend should refresh via the `refresh_token` cookie.

**`403 Forbidden` on a valid route**

- The handler's `@RequirePermission(...)` name isn't in `req.permissions`. Confirm the permission is granted to the caller's role in `src/orgs/system-roles.ts` and seeded in `prisma/seed.ts`, then re-seed.

**`404` on a resource you know exists**

- Almost always a tenant-scope mismatch — the id doesn't belong to the `projectId`/`orgId` in the URL. This is the isolation guarantee working as intended.

**Repeated `invalid credentials` even though the password is correct**

- After 5 failed signin attempts the account is locked for 15 minutes — and during the lockout the API keeps answering `invalid credentials`, even for the right password. A locked account is deliberately indistinguishable from a wrong password (anti-enumeration; see `auth.service.ts`). Wait out the 15 minutes and sign in again.

**Prisma client is out of date after a schema edit**

- Run `corepack pnpm db:generate` (and `corepack pnpm migrate:dev` to create/apply the migration).

**Database connection errors**

- Verify `DATABASE_URL`, ensure PostgreSQL is running, and check credentials/permissions.

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [class-validator](https://github.com/typestack/class-validator)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Argon2 Hashing](https://github.com/ranisalt/node-argon2)

---

See [`README.md`](README.md) for quick start, setup, and the canonical environment-variable reference.

See [`AGENTS.md`](AGENTS.md) (symlinked as `CLAUDE.md`) for the full architecture, endpoint table, and command reference.
