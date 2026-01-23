# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code (runs both oxlint and eslint with auto-fix)
npm run lint

# Format code with Prettier
npm run format
```

## Architecture Overview

This is a Vue 3 SPA built with Vite, using a Pinia store composables pattern for state management. The app implements JWT-based authentication with automatic token refresh.

### Tech Stack

- **Vue 3** with Composition API (no TypeScript)
- **Pinia** for state management
- **Ant Design Vue** for UI components
- **Axios** for HTTP requests
- **Vue Router** with navigation guards

### Layered Architecture

```
├── src/
│   ├── api/          # API service layer (pure HTTP calls)
│   ├── stores/       # Pinia stores (business logic, state)
│   ├── composables/  # Composables (form handling, UI state, validation)
│   ├── views/        # Page components
│   ├── components/   # Reusable components
│   ├── router/       # Vue Router config with auth guards
│   └── utils/        # Utilities (axios instance, localStorage)
```

### Key Architectural Patterns

**1. API Layer (`src/api/`)**
- Pure HTTP service functions using the configured axios instance
- No business logic, just request/response handling
- Example: `signup()`, `signin()`, `getTodos()`, `createTodo()`

**2. Store Layer (`src/stores/`)**
- Pinia stores using composition API setup syntax
- Manage domain state and orchestrate API calls
- Handle success/error messages via Ant Design's `message`
- Example: `useAuthStore`, `useTodosStore`

**3. Composables Layer (`src/composables/`)**
- Bridge between stores and components
- Handle form state, validation rules, UI interactions
- Expose convenience computed properties
- Example: `useAuth()`, `useTodos()`

**4. Axios Interceptors (`src/utils/request.js`)**
- Request interceptor: Attaches access token via `x-access-token` header
- Response interceptor: Handles 401 errors with automatic token refresh
- Uses `x-refresh-token` header for refresh endpoint
- Queues concurrent requests during refresh to prevent race conditions
- Redirects to `/login` on refresh failure

### Authentication Flow

1. Login stores `access_token` and `refresh_token` in localStorage
2. All API calls include access token via `x-access-token` header
3. On 401 response, interceptor attempts refresh using `x-refresh-token`
4. Refresh stores new access token and retries failed request
5. Router guard checks `isAuthenticated` before protected routes

### Environment Configuration

- `VITE_API_BASE_URL` - Backend API base URL (default: `http://localhost:3000/api`)
- Copy `.env.example` to `.env` to configure

### Code Style

- **Linting**: Dual-linter setup with oxlint (fast) and eslint (comprehensive)
- **Formatting**: Prettier with semicolons disabled, double quotes, 100 char width
- **Import alias**: `@` maps to `src/` directory

### File Naming

- Views: `*View.vue` (e.g., `LoginView.vue`, `TodosListView.vue`)
- Components: PascalCase (e.g., `AppLayout.vue`, `TodoFormModal.vue`)
- Stores: camelCase with `use` prefix (e.g., `useAuthStore`)
- Composables: camelCase with `use` prefix (e.g., `useAuth`, `useTodos`)
