# Vue Template

A fully-featured Vue 3 starter template with authentication, CRUD operations, and a scalable architecture pattern. Built with modern best practices and ready for production.

This is my personal project that can be used together with the following backend repositories:

- [express-template](https://github.com/dnwandana/express-template) - Node.js/Express backend
- [go-api-template](https://github.com/dnwandana/go-api-template) - Go backend

## Features

- **Authentication System**
  - User signup and login with JWT tokens
  - Automatic token refresh on expiration
  - Protected routes with navigation guards
  - Persistent sessions with localStorage

- **Todo Management**
  - Create, read, update, and delete todos
  - Bulk delete operations
  - Paginated list view with customizable page sizes
  - Sortable by title or update date
  - Status tracking (completed/pending)

- **Developer Experience**
  - Fast HMR with Vite
  - Dual-linting setup (oxlint + eslint)
  - Code formatting with Prettier
  - Vue DevTools integration
  - Clean, layered architecture

## Tech Stack

| Technology     | Purpose                                            |
| -------------- | -------------------------------------------------- |
| Vue 3          | Progressive JavaScript framework (Composition API) |
| Vite           | Next-generation frontend tooling                   |
| Pinia          | State management                                   |
| Ant Design Vue | UI component library                               |
| Axios          | HTTP client with interceptors                      |
| Vue Router     | Client-side routing with guards                    |

## Backend

This Vue template is designed to work with compatible backend APIs. You can use one of these backend templates:

- [express-template](https://github.com/dnwandana/express-template) - Express.js with JWT auth, todo CRUD, PostgreSQL
- [go-api-template](https://github.com/dnwandana/go-api-template) - Go with JWT auth, todo CRUD, PostgreSQL

Both backends provide:

- JWT authentication (signup, signin, refresh)
- RESTful API for todo management
- Compatible API endpoints

## Prerequisites

- **Node.js**: `^20.19.0 || >=22.12.0`
- A running backend API (see Backend section above)

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and set your API base URL:

   ```
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:8080`

## Development Commands

```bash
# Start dev server (port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linters (oxlint + eslint with auto-fix)
npm run lint

# Format code with Prettier
npm run format
```

## Project Structure

The application follows a layered architecture pattern for maintainability and scalability:

```
src/
├── api/           # API service layer - pure HTTP calls
├── stores/        # Pinia stores - business logic and state
├── composables/   # Composables - form handling, UI state
├── views/         # Page components - *View.vue naming
├── components/    # Reusable components
├── router/        # Vue Router configuration with auth guards
└── utils/         # Utilities (axios instance, localStorage)
```

### Layer Architecture

1. **API Layer** (`src/api/`) - Service functions that make HTTP requests
2. **Store Layer** (`src/stores/`) - Pinia stores that manage domain state
3. **Composable Layer** (`src/composables/`) - Reusable composition functions for UI logic
4. **View Layer** (`src/views/`) - Page components that use composables

This separation ensures each layer has a single responsibility and makes testing easier.

## Code Style

- **Linters**: oxlint (fast) + eslint (comprehensive)
- **Formatter**: Prettier
- **Rules**: No semicolons, double quotes, 100 char line width
- **Import alias**: `@` maps to `src/`

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
