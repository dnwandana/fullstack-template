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

# Lint code (runs oxlint then eslint sequentially via npm-run-all2)
npm run lint

# Format code with Prettier
npm run format
```

## Architecture Overview

Vue 3 SPA built with Vite, using a Pinia store + composables pattern for state management. The app implements cookie-based authentication with automatic token refresh via a custom fetch-based HTTP client (httpOnly cookies set by the server).

### Tech Stack

- **Vue 3** with Composition API (no TypeScript)
- **Pinia** for state management (composition API setup syntax)
- **Ant Design Vue** for UI components
- **Native fetch API** for HTTP requests (custom client in `src/utils/http.js`)
- **Vue Router** with navigation guards

### Layered Architecture

```
├── src/
│   ├── api/          # API service layer (pure HTTP calls via custom client)
│   ├── stores/       # Pinia stores (business logic, state)
│   ├── composables/  # Composables (form handling, UI state, validation)
│   ├── views/        # Page components (lazy-loaded via dynamic imports)
│   ├── components/   # Reusable components (modals, tables, layout)
│   ├── router/       # Vue Router config with auth guards
│   └── utils/        # Utilities (HTTP client, localStorage wrappers)
```

## Route Table

| Path                                         | Name            | Component                                 | Auth Meta       |
| -------------------------------------------- | --------------- | ----------------------------------------- | --------------- |
| `/login`                                     | Login           | `views/auth/LoginView.vue`                | `requiresGuest` |
| `/signup`                                    | Signup          | `views/auth/SignupView.vue`               | `requiresGuest` |
| `/`                                          | —               | redirect to `/orgs`                       | —               |
| `/orgs`                                      | OrgsList        | `views/orgs/OrgsListView.vue`             | `requiresAuth`  |
| `/orgs/:orgId`                               | ProjectsList    | `views/projects/ProjectsListView.vue`     | `requiresAuth`  |
| `/orgs/:orgId/settings`                      | OrgSettings     | `views/settings/OrgSettingsView.vue`      | `requiresAuth`  |
| `/orgs/:orgId/projects/:projectId`           | TodosList       | `views/todos/TodosListView.vue`           | `requiresAuth`  |
| `/orgs/:orgId/projects/:projectId/todos/:id` | TodoDetail      | `views/todos/TodoDetailView.vue`          | `requiresAuth`  |
| `/orgs/:orgId/projects/:projectId/settings`  | ProjectSettings | `views/settings/ProjectSettingsView.vue`  | `requiresAuth`  |
| `/invitations`                               | MyInvitations   | `views/invitations/MyInvitationsView.vue` | `requiresAuth`  |
| `/:pathMatch(.*)*`                           | —               | redirect to `/orgs`                       | —               |

**Navigation guard**: Unauthenticated users on `requiresAuth` routes are redirected to `/login` with `?redirect=`. Authenticated users on `requiresGuest` routes are redirected to `/orgs`. Auth store is initialized from localStorage on first navigation.

## HTTP Client (`src/utils/http.js`)

Custom fetch-based client (NOT Axios). Key behaviors:

- **Base URL**: `VITE_API_BASE_URL` env var (default: `http://localhost:3000/api`)
- **Timeout**: 10 seconds via `AbortController`
- **Auth cookies**: `credentials: 'include'` on all fetch calls, cookies set by server
- **Token refresh flow**: On 401 responses:
  1. Queues concurrent requests in `failedQueue` to prevent refresh race conditions
  2. Sends refresh request (cookie-based) to `POST /auth/refresh`
  3. On success: server rotates and sets new httpOnly cookies, replays queued requests
  4. On failure: clears auth data, redirects to `/login`
- **Excluded from refresh retry**: `/auth/signin`, `/auth/signup`, `/auth/refresh`
- **Error handling**: Non-401 errors trigger `message.error()` toast automatically
- **Exports**: `baseURL` (const), `HttpError` (class), `request` (object with `send`, `get`, `post`, `put`, `del`)

## Authentication Flow

1. **Signin**: `LoginView.vue` → `useAuth().handleSignin()` → `useAuthStore().signin()` → `api/auth.js signin()` → `POST /auth/signin` → server sets httpOnly cookies (`access_token` + `refresh_token`) + returns user data → stores user data in localStorage → redirects to `/orgs`
2. **Token attachment**: Every API call includes `credentials: 'include'` so cookies are sent automatically by the browser
3. **Token refresh**: Automatic on 401 responses. Server rotates both tokens via httpOnly cookies.
4. **Logout**: `AppLayout.vue` → `authStore.logout()` → `POST /auth/logout` (best-effort, cookies sent automatically) → clears all localStorage → redirects to `/login`
5. **Route protection**: `router.beforeEach` guard calls `authStore.initAuth()` on first nav, then checks `requiresAuth`/`requiresGuest` meta flags
6. **Permission loading**: On entering org-scoped pages, `loadPermissions(orgId, userId)` resolves the user's role and extracts permission name strings for UI gating via `can()` and `canAny()`

## Store Catalog

| Store                 | File                    | State                                                                                                                      | Key Actions                                                                                                                                                 |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuthStore`        | `stores/auth.js`        | `user`, `loading`                                                                                                          | `initAuth`, `signup`, `signin`, `logout`                                                                                                                    |
| `useOrgsStore`        | `stores/orgs.js`        | `orgs`, `currentOrg`, `loading`                                                                                            | `fetchOrgs`, `fetchOrgById`, `createOrg`, `updateOrg`, `deleteOrg`                                                                                          |
| `useProjectsStore`    | `stores/projects.js`    | `projects`, `currentProject`, `loading`                                                                                    | `fetchProjects`, `fetchProjectById`, `createProject`, `updateProject`, `deleteProject`                                                                      |
| `useTodosStore`       | `stores/todos.js`       | `todos`, `currentTodo`, `pagination`, `selectedIds`, `sortBy`, `sortOrder`, `searchQuery`, `orgId`, `projectId`, `loading` | `setContext`, `fetchTodos`, `fetchTodoById`, `createTodo`, `updateTodo`, `deleteTodo`, `bulkDelete`, `toggleSelection`, `selectAll`, `setSort`, `setSearch` |
| `useRolesStore`       | `stores/roles.js`       | `roles`, `currentRole`, `allPermissions`, `userPermissions`, `loading`                                                     | `fetchRoles`, `fetchRoleById`, `createRole`, `updateRole`, `deleteRole`, `fetchAllPermissions`, `loadUserPermissions`                                       |
| `useMembersStore`     | `stores/members.js`     | `orgMembers`, `projectMembers`, `loading`                                                                                  | `fetchOrgMembers`, `fetchProjectMembers`, `updateOrgMemberRole`, `removeOrgMember`, `updateProjectMemberRole`, `removeProjectMember`                        |
| `useInvitationsStore` | `stores/invitations.js` | `orgInvitations`, `myInvitations`, `loading`                                                                               | `fetchOrgInvitations`, `fetchMyInvitations`, `inviteToOrg`, `inviteToProject`, `acceptInvitation`, `declineInvitation`, `revokeInvitation`                  |

## Composable Catalog

| Composable       | File                            | Returns                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuth`        | `composables/useAuth.js`        | `formState`, `error`, `loading`, `isAuthenticated`, `currentUser`, validation rules, `handleSignin`, `handleSignup`, `handleLogout`, `resetForm`                                                                                         |
| `useOrgs`        | `composables/useOrgs.js`        | `orgs`, `currentOrg`, `loading`, modal state, validation rules, CRUD wrappers, `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit`                                                                                          |
| `useProjects`    | `composables/useProjects.js`    | `projects`, `currentProject`, `loading`, modal state, validation rules, CRUD wrappers, `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit`                                                                                  |
| `useTodos`       | `composables/useTodos.js`       | `todos`, `pagination`, `loading`, `selectedIds`, `sortBy`, `sortOrder`, `searchQuery`, `currentTodo`, modal state, validation rules, CRUD wrappers, `setContext`, pagination/sort/search handlers, `isSelected`, `handleSelectionChange` |
| `useRoles`       | `composables/useRoles.js`       | `roles`, `currentRole`, `allPermissions`, `loading`, modal state, validation rules, CRUD wrappers, `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit`                                                                      |
| `useMembers`     | `composables/useMembers.js`     | `orgMembers`, `projectMembers`, `loading`, role-change modal state, `fetchOrgMembers`, `fetchProjectMembers`, `openRoleModal`, `closeRoleModal`, `handleRoleChange`, `handleRemove`                                                      |
| `useInvitations` | `composables/useInvitations.js` | `orgInvitations`, `myInvitations`, `loading`, `pendingCount`, invite modal state, `fetchOrgInvitations`, `fetchMyInvitations`, `openInviteModal`, `closeInviteModal`, `handleInvite`, `handleAccept`, `handleDecline`, `handleRevoke`    |
| `usePermissions` | `composables/usePermissions.js` | `userPermissions`, `can(permission)`, `canAny(permissions[])`, `loadPermissions(orgId, userId)`, `clearPermissions`                                                                                                                      |

## Component Catalog

| Component          | File                              | Purpose                                                                                                                            |
| ------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AppLayout`        | `components/AppLayout.vue`        | Main shell: header with org/project selectors, pending invitations badge, logout button, collapsible sidebar, content slot, footer |
| `AppSidebar`       | `components/AppSidebar.vue`       | Context-aware navigation menu that adapts based on current route (org list, org-scoped, or project-scoped)                         |
| `OrgFormModal`     | `components/OrgFormModal.vue`     | Create/edit organization modal form (name + description)                                                                           |
| `ProjectFormModal` | `components/ProjectFormModal.vue` | Create/edit project modal form (name + description)                                                                                |
| `TodoFormModal`    | `components/TodoFormModal.vue`    | Create/edit todo modal form (title + description + completed checkbox)                                                             |
| `RoleFormModal`    | `components/RoleFormModal.vue`    | Create/edit role modal with permissions grouped by resource as checkboxes                                                          |
| `InviteFormModal`  | `components/InviteFormModal.vue`  | Invite member modal — toggle between username/email input, with role selection dropdown                                            |
| `MembersTable`     | `components/MembersTable.vue`     | Members table with inline role-change dropdown and remove button with confirmation                                                 |
| `InvitationsTable` | `components/InvitationsTable.vue` | Invitations table with color-coded status tags and revoke button for pending invitations                                           |

## API Service Catalog

| Module         | File                    | Exports                                                                                                                                  |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| auth           | `api/auth.js`           | `signup`, `signin`, `refreshToken`, `logout`                                                                                             |
| orgs           | `api/orgs.js`           | `getOrgs`, `getOrg`, `createOrg`, `updateOrg`, `deleteOrg`                                                                               |
| projects       | `api/projects.js`       | `getProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`                                                           |
| todos          | `api/todos.js`          | `getTodos`, `getTodoById`, `createTodo`, `updateTodo`, `deleteTodo`, `deleteTodos`                                                       |
| roles          | `api/roles.js`          | `getRoles`, `getRole`, `createRole`, `updateRole`, `deleteRole`                                                                          |
| permissions    | `api/permissions.js`    | `getPermissions`                                                                                                                         |
| invitations    | `api/invitations.js`    | `inviteToOrg`, `inviteToProject`, `listOrgInvitations`, `listMyInvitations`, `acceptInvitation`, `declineInvitation`, `revokeInvitation` |
| orgMembers     | `api/orgMembers.js`     | `getOrgMembers`, `updateOrgMemberRole`, `removeOrgMember`                                                                                |
| projectMembers | `api/projectMembers.js` | `getProjectMembers`, `updateProjectMemberRole`, `removeProjectMember`                                                                    |

## Utility Files

| File               | Exports                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `utils/http.js`    | `baseURL` (const), `HttpError` (class), `request` object (`send`, `get`, `post`, `put`, `del`) |
| `utils/storage.js` | `getUserData`, `setUserData`, `clearUserData`, `clearAuthData`                                 |

## Environment Configuration

- `VITE_API_BASE_URL` - Backend API base URL (default: `http://localhost:3000/api`)
- Copy `.env.example` to `.env` to configure

## Code Style

- **Linting**: Dual-linter setup with oxlint (fast) then eslint (comprehensive) via npm-run-all2
- **Formatting**: Prettier with semicolons disabled, double quotes, 100 char width
- **Import alias**: `@` maps to `src/` directory
- **No tests** currently exist for the frontend app

## File Naming

- Views: `*View.vue` (e.g., `LoginView.vue`, `TodosListView.vue`)
- Components: PascalCase (e.g., `AppLayout.vue`, `TodoFormModal.vue`)
- Stores: camelCase with `use` prefix (e.g., `useAuthStore`)
- Composables: camelCase with `use` prefix (e.g., `useAuth`, `useTodos`)
- API modules: camelCase (e.g., `auth.js`, `orgMembers.js`)
