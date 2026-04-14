# Express API Template

A production-ready RESTful API template built with Express.js, featuring PostgreSQL, JWT authentication, and a multi-tenant architecture with organization-based access control. Designed to jumpstart your next Node.js API project.

## Features

### Authentication & Security

- **JWT Authentication**: Dual-token system with access tokens (15min) and refresh tokens (7 days), pinned to HS256
- **Password Hashing**: Argon2 for secure password storage
- **Security Headers**: Helmet with strict Content Security Policy and referrer protection
- **CORS**: Configurable allowed origins via environment variable
- **Rate Limiting**: Configurable per-route and global rate limits (express-rate-limit)
- **HPP Protection**: HTTP Parameter Pollution prevention
- **Input Validation**: Joi schemas for request validation with ILIKE wildcard sanitization
- **Environment Validation**: Startup checks for required variables and secret strength
- **Body Size Limits**: 100kb cap on JSON and URL-encoded payloads
- **Pagination & Search**: Reusable utility for paginated queries with sorting and case-insensitive search

### Multi-Tenant Architecture

- **Organization hierarchy**: Organization → Project → Todos with shared database tenant isolation via `org_id` and `project_id` columns
- **Flexible membership**: Users can belong to multiple organizations and multiple projects (GitHub-style model)
- **Custom RBAC**: 4 built-in system roles (owner, admin, member, viewer) plus custom roles with granular permission assignment
- **16 system permissions**: covering org management, project management, invitation management, and todo operations
- **Invitation system**: Invite by username or email, 7-day token expiry, accept/decline flow; project invitations auto-add the user to the org as viewer if not already a member

### Database & Architecture

- **PostgreSQL**: Robust relational database (10 tables)
- **Knex.js**: SQL query builder with migration support
- **MVC Pattern**: Clean separation of concerns (Models, Controllers, Routes)
- **ES Modules**: Modern JavaScript with `import/export` syntax

### Observability & Reliability

- **Request ID Tracking**: Automatic `X-Request-Id` correlation across logs and responses (accepts incoming or generates UUID)
- **Health Check**: `GET /health` endpoint with database connectivity probe, exempt from rate limiting
- **Logging**: Winston + Morgan for structured logging with daily rotation, request IDs in every log entry

### Developer Experience

- **Standardized Responses**: Consistent API response format
- **Error Handling**: Centralized error handling middleware
- **Testing**: Vitest + Supertest with real PostgreSQL test database, 64 tests across 8 test files
- **OpenAPI Spec**: API documentation included (`openapi.json`)
- **Environment Config**: dotenv for environment-specific settings
- **Code Quality**: Oxlint for fast linting, Prettier for consistent formatting

## Tech Stack

| Component          | Version                                | Description                |
| ------------------ | -------------------------------------- | -------------------------- |
| **Runtime**        | Node.js >=24.0.0                       | JavaScript runtime         |
| **Framework**      | Express.js ^5.2.1                      | Web application framework  |
| **Database**       | PostgreSQL ^8.16.3                     | Relational database        |
| **ORM**            | Knex.js ^3.1.0                         | Query builder & migrations |
| **Authentication** | JWT ^9.0.3, Argon2 ^0.43.1             | Token-based auth & hashing |
| **Validation**     | Joi ^17.13.3                           | Schema validation          |
| **Security**       | Helmet ^8.1.0, CORS ^2.8.5, HPP ^0.2.3 | Security middleware        |
| **Rate Limiting**  | express-rate-limit ^8.2.1              | Request throttling         |
| **Logging**        | Winston ^3.19.0, Morgan ^1.10.1        | Structured logging         |
| **Testing**        | Vitest ^4.0.18, Supertest ^7.2.2       | Test runner & HTTP testing |
| **Code Quality**   | Oxlint ^1.41.0, Prettier ^3.8.1        | Linting and formatting     |

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
npm run migrate
npm run seed

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
| `RATE_LIMIT_AUTH_MAX`      | Auth endpoint rate limit (per 15min) | `10`                    | No       |
| `RATE_LIMIT_GENERAL_MAX`   | Global rate limit (per 15min)        | `100`                   | No       |

**Example DATABASE_URL:**

```
postgresql://username:password@localhost:5432/database_name
```

**Security Note:** JWT secrets must be at least 32 characters. The server validates all required environment variables at startup and will refuse to start with missing or weak secrets. Generate secrets with:

```bash
openssl rand -hex 32
```

## Logging

This template includes a comprehensive logging system powered by Winston and Morgan:

### Features

- **Structured Logging**: JSON-formatted logs for easy parsing and analysis
- **Daily Rotation**: Automatic log file rotation (keeps 14 days of logs)
- **Multiple Transports**: Console (always) and file (when `LOG_TO_FILE=true`)
- **HTTP Request Logging**: Morgan middleware for HTTP request/response logging
- **Log Levels**: error, warn, info, http, debug

### Log Files

When `LOG_TO_FILE=true`, logs are stored in the `logs/` directory:

- `error-YYYY-MM-DD.log` - Error-level logs only
- `combined-YYYY-MM-DD.log` - All logs (info level and above)

File logging is enabled by default. Set `LOG_TO_FILE=false` for containerized and serverless environments where logs should go to stdout/stderr.

### Log Levels

Set the `LOG_LEVEL` environment variable to control logging verbosity:

| Level   | Description                        |
| ------- | ---------------------------------- |
| `error` | Error messages only                |
| `warn`  | Warnings and errors                |
| `info`  | Informational messages (default)   |
| `http`  | HTTP request logging               |
| `debug` | Debug information (verbose output) |

### Usage Example

```javascript
import logger from "./utils/logger.js"

// Different log levels
logger.error("Error message", { errorDetails: "..." })
logger.warn("Warning message")
logger.info("Info message", { userId: "123", action: "login" })
logger.debug("Debug message", { data: "..." })
```

## Pagination & Search

This template includes a reusable pagination utility (`src/utils/pagination.js`) that handles query validation, parallel data fetching, and metadata construction.

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

### Adding Pagination to a New Resource

```javascript
import { validatePaginationQuery, executePaginatedQuery } from "../utils/pagination.js"

const params = validatePaginationQuery(req.query, ["updated_at", "name"])
const { data, pagination } = await executePaginatedQuery(
  model.count,
  model.findManyPaginated,
  { org_id: orgId, project_id: projectId },
  params,
  ["name"], // searchable columns
)
```

## Development Commands

### Server

```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

Tests use a real PostgreSQL test database configured in `.env.test`. The global setup runs migrations and truncates tables before tests, then rolls back migrations on teardown. Tests cover auth, health, todos (multi-tenant paths), organizations, permissions enforcement, cross-tenant isolation, and cascade deletes.

### Linting & Formatting

```bash
npm run lint         # Run Oxlint (linter)
npm run lint:fix     # Auto-fix issues with Oxlint
npm run format       # Check formatting with Prettier
npm run format:fix   # Apply formatting with Prettier
```

**Note**: Run `npm run lint:fix` and `npm run format:fix` before committing.

### Database Migrations

```bash
npm run migrate                # Run all pending migrations
npm run migrate:make <name>    # Create a new migration file
npm run migrate:rollback       # Rollback the last migration
```

### Database Seeds

```bash
npm run seed               # Run all seed files
npm run seed:make <name>   # Create a new seed file
```

Seeds are for development only and populate: permissions, users (5), organizations (2), system roles per org, role_permissions, org_members, projects, project_members, and todos.

## API Documentation

This template includes an OpenAPI 3.0 specification (`openapi.json`) that documents all API endpoints.

### Health Check

| Method | Endpoint  | Description                             | Auth Required |
| ------ | --------- | --------------------------------------- | ------------- |
| GET    | `/health` | Health check with database connectivity | No            |

### Authentication Endpoints

| Method | Endpoint            | Description                | Auth Required |
| ------ | ------------------- | -------------------------- | ------------- |
| POST   | `/api/auth/signup`  | Create new user account    | No            |
| POST   | `/api/auth/signin`  | Sign in and receive tokens | No            |
| POST   | `/api/auth/refresh` | Refresh access token       | Refresh Token |

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

| Method | Endpoint                                             | Description                 | Auth Required |
| ------ | ---------------------------------------------------- | --------------------------- | ------------- |
| POST   | `/api/orgs/:org_id/invitations`                      | Create org invitation       | Access Token  |
| GET    | `/api/orgs/:org_id/invitations`                      | List org invitations        | Access Token  |
| DELETE | `/api/orgs/:org_id/invitations/:invitation_id`       | Revoke invitation           | Access Token  |
| POST   | `/api/orgs/:org_id/projects/:project_id/invitations` | Create project invitation   | Access Token  |
| GET    | `/api/invitations`                                   | List my pending invitations | Access Token  |
| POST   | `/api/invitations/:invitation_id/accept`             | Accept invitation           | Access Token  |
| POST   | `/api/invitations/:invitation_id/decline`            | Decline invitation          | Access Token  |

### Permissions Endpoint

| Method | Endpoint           | Description                 | Auth Required |
| ------ | ------------------ | --------------------------- | ------------- |
| GET    | `/api/permissions` | List all system permissions | Access Token  |

### Authentication Format

Protected endpoints require the access token in the `x-access-token` header:

```
x-access-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token refresh requires the refresh token in the `x-refresh-token` header:

```
x-refresh-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

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

## Project Structure

```
express-template/
├── src/
│   ├── config/              # Configuration files (Knex)
│   ├── controllers/         # Business logic layer
│   │   ├── authentication.js
│   │   ├── invitations.js
│   │   ├── members.js        # Shared org/project member management
│   │   ├── organizations.js
│   │   ├── permissions.js
│   │   ├── projects.js
│   │   ├── roles.js
│   │   └── todos.js
│   ├── middlewares/         # Express middleware
│   │   ├── authorization.js  # JWT verification
│   │   ├── error.js          # Error handling & 404 handler
│   │   ├── logger.js         # HTTP request logging
│   │   ├── rate-limit.js     # Rate limiting (auth + general)
│   │   ├── request-id.js     # X-Request-Id correlation tracking
│   │   ├── require-permission.js # Permission gate
│   │   ├── resolve-org.js    # Resolves org, verifies membership, loads permissions
│   │   └── resolve-project.js # Resolves project, merges permissions
│   ├── models/              # Data access layer
│   │   ├── invitations.js
│   │   ├── org-members.js
│   │   ├── organizations.js
│   │   ├── permissions.js
│   │   ├── project-members.js
│   │   ├── projects.js
│   │   ├── roles.js
│   │   ├── todos.js
│   │   └── users.js
│   ├── routes/              # API route definitions
│   │   ├── index.js          # Route aggregator
│   │   ├── authentication.js
│   │   ├── health.js
│   │   ├── invitations.js    # Org invitations
│   │   ├── org-members.js
│   │   ├── organizations.js
│   │   ├── permissions.js
│   │   ├── project-invitations.js
│   │   ├── project-members.js
│   │   ├── projects.js
│   │   ├── roles.js
│   │   ├── todos.js
│   │   └── user-invitations.js # /api/invitations (my invitations)
│   ├── utils/               # Utility functions
│   │   ├── argon2.js         # Password hashing
│   │   ├── constant.js       # HTTP constants
│   │   ├── http-error.js     # Custom error class
│   │   ├── jwt.js            # JWT utilities
│   │   ├── logger.js         # Winston logger
│   │   ├── pagination.js     # Reusable pagination & search
│   │   ├── response.js       # Response formatter
│   │   ├── sanitize.js       # Input sanitization (ILIKE escaping)
│   │   └── validate-env.js   # Startup environment validation
│   ├── app.js                # Express app configuration (middleware + routes)
│   └── index.js              # Entry point (env validation + server start)
├── database/
│   ├── migrations/          # Database migration files (10 tables)
│   └── seeds/               # Database seed files (9 seed files)
├── logs/                    # Application logs (created at runtime)
│   ├── error-YYYY-MM-DD.log    # Error logs
│   └── combined-YYYY-MM-DD.log # All logs
├── tests/                   # Test suite (64 tests across 8 files)
│   ├── unit/                  # Unit tests (pure logic)
│   ├── integration/           # Integration tests (HTTP endpoints)
│   ├── helpers.js             # Test utilities
│   └── global-setup.js        # DB setup/teardown
├── .editorconfig              # Editor configuration
├── .env.example               # Environment variable template
├── .nvmrc                     # Node.js version (24)
├── LICENSE                    # MIT license
├── openapi.json               # OpenAPI 3.0 specification
├── knexfile.js                # Knex configuration
├── CLAUDE.md                  # AI assistant reference
├── TEMPLATE_GUIDE.md          # Guide for extending this template
├── vitest.config.js           # Vitest test configuration
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
npm run migrate
```

### Starting the Server

```bash
npm start
```

### Security Considerations

- Use HTTPS in production
- JWT secrets are validated at startup (minimum 32 characters)
- Helmet enforces strict Content Security Policy (`default-src: 'none'`) and `no-referrer` policy
- CORS is restricted to explicit origins configured via `CORS_ALLOWED_ORIGINS`
- Rate limiting on auth endpoints (10 req/15min) and globally (100 req/15min), configurable via env vars
- HPP middleware prevents HTTP Parameter Pollution attacks
- Request body size is capped at 100kb to prevent payload abuse
- Configure database firewall rules
- Keep dependencies updated with `npm audit`
- Never commit `.env` file to version control

## Using This Template

See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) for detailed instructions on:

- MVC architecture patterns
- Adding new features step-by-step
- Database migrations and seeding
- Authentication & authorization
- Input validation patterns
- Common recipes (pagination, sorting, filtering)
