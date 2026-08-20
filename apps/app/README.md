# Vue Template

A fully-featured Vue 3 starter template with authentication, CRUD operations, and a scalable architecture pattern. Built with modern best practices and ready for production.

## Monorepo Usage

This package now lives at `apps/app` inside the monorepo.

From the repository root, run:

```bash
corepack pnpm dev:app
corepack pnpm build:app
corepack pnpm typecheck:app
corepack pnpm lint:app
```

You can still run package-local commands from `apps/app` with `corepack pnpm`.

Its backend is the NestJS API in [`apps/api`](../api/README.md), shipped in this same repo. An
earlier standalone backend, [express-template](https://github.com/dnwandana/express-template),
implements the same auth and todo contract and works as an alternative — see
[Backend](#backend).

## Features

- **Authentication System**
  - User signup and login with httpOnly cookie-based JWT tokens
  - Automatic token refresh on expiration (server rotates cookies)
  - Protected routes with navigation guards
  - Persistent sessions via localStorage (user data only — tokens in httpOnly cookies)

- **Todo Management**
  - Create, read, update, and delete todos
  - Bulk delete operations
  - Paginated list view with customizable page sizes
  - Sortable by title or update date
  - Status tracking (completed/pending)

- **Developer Experience**
  - Fast HMR with Vite
  - TypeScript under `strict`, with API response types shared from `@fullstack/contracts`
  - Dual-linting setup (oxlint + eslint)
  - Code formatting with Prettier
  - Vue DevTools integration (development only)
  - Clean, layered architecture

## Tech Stack

| Technology     | Purpose                                             |
| -------------- | --------------------------------------------------- |
| Vue 3          | Progressive framework (Composition API, TypeScript) |
| TypeScript     | `strict` throughout `src/`, checked by `vue-tsc`    |
| Vite           | Next-generation frontend tooling                    |
| Pinia          | State management                                    |
| Ant Design Vue | UI component library                                |
| Fetch API      | Native HTTP client with cookie-based auth           |
| Vue Router     | Client-side routing with guards                     |

## Backend

This SPA is built against the NestJS API in [`apps/api`](../api/README.md) — same repo, same
release. It expects that API's contract: snake_case JSON, the `{ message, data, pagination? }`
envelope, and `access_token` / `refresh_token` httpOnly cookies.

The template also works against [express-template](https://github.com/dnwandana/express-template),
an earlier standalone backend implementing the same auth and todo contract.

## Prerequisites

- **Node.js**: `>=24.0.0` — declared as `engines.node` in this package's `package.json` and in
  every other workspace package, pinned by the repo-root `.nvmrc`. `engineStrict: true` in
  `pnpm-workspace.yaml` makes it a hard gate: an older Node fails `corepack pnpm install` outright
  rather than warning and installing anyway.
- A running backend API (see [Backend](#backend) above)

## Quick Start

1. **Install dependencies**

   ```bash
   corepack pnpm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set your API base URL:

   ```
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

   This step is not optional. `src/utils/http.ts` reads `VITE_API_BASE_URL` once at module load
   and applies **no fallback**, so skipping the copy leaves the base URL `undefined` and every
   request goes to a URL like `"undefined/orgs"`.

3. **Start the development server**
   ```bash
   corepack pnpm dev
   ```
   The app will be available at `http://localhost:8080`

## Development Commands

```bash
# Start dev server (port 8080)
corepack pnpm dev

# Build for production (vue-tsc type-check, then vite build)
corepack pnpm build

# Preview production build
corepack pnpm preview

# Run tests (Vitest, single run)
corepack pnpm test

# Run tests in watch mode
corepack pnpm test:watch

# Type-check the app with vue-tsc (all three tsconfig project references)
corepack pnpm typecheck

# Run linters (oxlint + eslint with auto-fix)
corepack pnpm lint

# Format code with Prettier
corepack pnpm format
```

## Project structure

The layer architecture — view → composable → store → api service → HTTP client — is documented in
[`AGENTS.md`](AGENTS.md#layered-architecture). What lives in each directory is best read straight
off `ls src/<layer>/`; `AGENTS.md` records only the contracts the filenames do not reveal, under
[Stores](AGENTS.md#stores), [Composables](AGENTS.md#composables), and
[API Service Layer](AGENTS.md#api-service-layer).

## Code style

Prettier plus Oxlint and ESLint, all configured in this directory — the config files are
authoritative. Note that `corepack pnpm lint` here is `run-s lint:*`, which **auto-fixes** with both
linters, and `format` is scoped to `src/`, so `*.md` in this package has no Prettier owner. The
naming conventions that are not mechanically enforced are in
[`AGENTS.md`](AGENTS.md#file-naming).

## TypeScript

`src/` is TypeScript under `strict`, split across four tsconfigs (a solution file plus app, node and
vitest projects) and checked with `vue-tsc -b`. Every SFC is `<script setup lang="ts">`, and the
lint config rejects one that is not. API response types come from the workspace package
[`@fullstack/contracts`](../../packages/contracts), consumed as `Wire<Entity>` because `Date` fields
arrive over the wire as strings. The traps worth knowing before you add a file — which config owns
which glob, why `node` types are kept out of the app project, and the two deliberate type
suppressions — are in [`AGENTS.md`](AGENTS.md#typescript).

## Browser DevTools Setup

For the best development experience, install the Vue.js devtools browser extension:

### Chromium-based browsers (Chrome, Edge, Brave)

- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- [Enable Custom Object Formatter](http://bit.ly/object-formatters)

### Firefox

- [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
- [Enable Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Using This Template

See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) for detailed instructions on:

- Customizing this template for your project
- Adding new features following the architecture pattern
- Removing the todo features for a clean slate
