# Fullstack Template Monorepo

This repository consolidates:

- `apps/api` - Express.js backend (originally `express-template`)
- `apps/app` - Vue 3 frontend (originally `vue-template`)

Both projects are managed as a single workspace using `pnpm` and `Turborepo`.

## Structure

```text
fullstack-template/
├── apps/
│   ├── api/
│   └── app/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Prerequisites

- Node.js `>=24.0.0`
- Corepack (bundled with Node 24+)

## Install

```bash
corepack pnpm install
```

## Root Scripts

```bash
# Run both apps in development
corepack pnpm dev

# Run a single app
corepack pnpm dev:api
corepack pnpm dev:app

# Build
corepack pnpm build
corepack pnpm build:api
corepack pnpm build:app

# Lint
corepack pnpm lint
corepack pnpm lint:api
corepack pnpm lint:app

# Tests (API currently provides tests)
corepack pnpm test
corepack pnpm test:api
```

## Environment Setup

### API (`apps/api`)

```bash
cp apps/api/.env.example apps/api/.env
```

Set required variables (at minimum):

- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

### App (`apps/app`)

```bash
cp apps/app/.env.example apps/app/.env
```

Set:

- `VITE_API_BASE_URL=http://localhost:3000/api`

## Notes

- `pnpm dev` starts both apps together.
- If API env vars are missing, the API process fails fast (expected behavior).
- API tests require valid environment/database configuration.
