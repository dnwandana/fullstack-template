# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
corepack pnpm install

# Start dev server (runs on port 8080)
corepack pnpm dev

# Build for production
corepack pnpm build

# Preview production build
corepack pnpm preview

# Lint code (runs oxlint then eslint sequentially via npm-run-all2)
corepack pnpm lint

# Run tests
corepack pnpm test

# Run tests in watch mode
corepack pnpm test:watch

# Format code with Prettier
corepack pnpm format
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
│   ├── theme/        # antd.js — design tokens fed to ConfigProvider in App.vue
│   ├── assets/       # app.css + design-system/ (tokens, 7 woff2 faces)
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
| `/invite/:invitationId`                      | InviteAccept    | `views/invitations/InviteAcceptView.vue`  | — (public)      |
| `/orgs/:orgId/members`                       | OrgMembers      | `views/orgs/OrgMembersView.vue`           | `requiresAuth`  |
| `/orgs/:orgId/roles`                         | OrgRoles        | `views/orgs/OrgRolesView.vue`             | `requiresAuth`  |
| `/orgs/:orgId/invitations`                   | OrgInvitations  | `views/orgs/OrgInvitationsView.vue`       | `requiresAuth`  |
| `/orgs/:orgId/projects/:projectId/members`   | ProjectMembers  | `views/projects/ProjectMembersView.vue`   | `requiresAuth`  |
| `/orgs/:orgId/projects/:projectId/invitations` | ProjectInvitations | `views/projects/ProjectInvitationsView.vue` | `requiresAuth` |
| `/:pathMatch(.*)*`                           | —               | redirect to `/orgs`                       | —               |

Legacy `?tab=` URLs redirect to the matching route via a `beforeEnter` guard (`redirectLegacyTab`, applied to `OrgSettings` and `ProjectSettings`).

**`meta.permission` is declarative only.** The header comment in `router/index.js` states that route-level *enforcement* is not implemented in this release — the field records intent for a future guard and does **not** gate navigation today. `SideNav` hides nav items the user lacks, but it does so from its **own** `permission` field on each nav entry — a hand-maintained mirror of this table, not a read of `route.meta`. Keep the two in step. Access control itself is enforced server-side by `PermissionsGuard`, and the SPA hides actions via `usePermissions`, not via the router. Do not read this table as "the router blocks these routes".

| Route (name) | `meta.permission` |
| --- | --- |
| `ProjectsList` (`/orgs/:orgId`) | `project:read` |
| `OrgMembers` (`/orgs/:orgId/members`) | `org:read` |
| `OrgRoles` (`/orgs/:orgId/roles`) | `org:read` |
| `OrgInvitations` (`/orgs/:orgId/invitations`) | `invitations:manage` |
| `OrgSettings` (`/orgs/:orgId/settings`) | `org:update` |
| `TodosList` (`/orgs/:orgId/projects/:projectId`) | `todos:read` |
| `TodoDetail` (`…/todos/:id`) | `todos:read` |
| `ProjectMembers` (`…/members`) | `project:read` |
| `ProjectInvitations` (`…/invitations`) | `invitations:manage` |
| `ProjectSettings` (`…/settings`) | `project:update` |

`/orgs`, `/invitations`, `/login`, `/signup`, and `/invite/:invitationId` carry no `meta.permission` at all. `OrgRoles` gates on `org:read` rather than `org:manage_roles` on purpose — listing roles needs only `org:read` on the API side; editing is gated separately, in-template, on `org:manage_roles`.

**Navigation guard**: Unauthenticated users on `requiresAuth` routes are redirected to `/login` with `?redirect=`. Authenticated users on `requiresGuest` routes are redirected to `/orgs`. Routes carrying **neither** flag are public in any session state — the guard only acts on those two meta flags. `/invite/:invitationId` relies on that deliberately: `requiresAuth` would bounce a brand-new invitee to `/login` before they could see what they were invited to, and `requiresGuest` would bounce a signed-in user to `/orgs` before they could accept. Auth store is initialized on first navigation via `GET /auth/me`.

**Invite landing page**: `/invite/:invitationId?token=<64hex>` reads the token from the query string, calls the public preview endpoint, and renders one of `loading | invalid | expired | handled | guest | wrong-account | ready`. Arriving without `?token=` short-circuits to `invalid` — the token is the credential and no in-app list holds it. That is why `MyInvitationsView`'s primary action is **"Open invitation"** (navigation to `/invite/:id`) rather than "Accept": that view has no token and cannot redeem directly. Decline still works there, since declining requires no token.

## HTTP Client (`src/utils/http.js`)

Custom fetch-based client (NOT Axios). Key behaviors:

- **Base URL**: `VITE_API_BASE_URL`, read once at module load in `utils/http.js` (`export const baseURL = import.meta.env.VITE_API_BASE_URL`). There is **no code-level default** — if the variable is unset, `baseURL` is `undefined` and every request URL becomes `"undefined/orgs"`. The `http://localhost:3000/api` value lives only in `.env.example`, so a fresh clone that skips `cp .env.example .env` fails this way.
- **Timeout**: 10 seconds via `AbortController`
- **Auth cookies**: `credentials: 'include'` on all fetch calls, cookies set by server
- **Token refresh flow**: On 401 responses:
  1. Queues concurrent requests in `failedQueue` to prevent refresh race conditions
  2. Sends refresh request (cookie-based) to `POST /auth/refresh`
  3. On success: server rotates and sets new httpOnly cookies, replays queued requests
  4. On refresh failure: calls `clearUserData()`, then redirects to `/login` **unless** the failing request URL matches `NO_REDIRECT_ENDPOINTS` (`/auth/me`) or the browser is already on a path in `AUTH_PATHS` (`/login`, `/signup`). Both guards exist to break an infinite reload loop — `/auth/me` is the session probe `initAuth` fires — and while logged out `authStore.user` stays null, so the router guard re-fires it on *every* navigation — meaning a redirect on its failure re-triggers the probe on load, forever. A separate `NO_RETRY_ENDPOINTS` list (`/auth/signin`, `/auth/signup`, `/auth/refresh`) suppresses the refresh-retry itself; the two lists are different lists with different jobs.
- **Excluded from refresh retry** (`NO_RETRY_ENDPOINTS`): `/auth/signin`, `/auth/signup`, `/auth/refresh`
- **Error handling**: Non-401 errors trigger `message.error()` toast automatically
- **Exports**: `baseURL` (const), `HttpError` (class), `request` (object with `send`, `get`, `post`, `put`, `del`)
- **Request/response casing**: the API contract is snake_case throughout and the client does no conversion — stores consume the keys verbatim. Query params on paginated lists are `page`, `limit`, `sort_by`, `sort_order`, `search`. The pagination envelope is `current_page`, `total_pages`, `total_items`, `items_per_page`, `has_next_page`, `has_previous_page`, `next_page`, `previous_page`. Body fields follow the same rule: `is_completed`, `role_id`, `permission_ids`, `confirmation_password`, `user_id`, `role_name`, `joined_at`, `accept_url`.
- **Unwrap depth**: `send()` returns an axios-shaped `{ data, status }`, and the server envelope is `{ message, data, pagination? }`, so a payload is `response.data.data` — **not** `response.data.data.<resource>`. Every store unwraps at that depth; paginated lists read `response.data.pagination` alongside it.

## Authentication Flow

1. **Signin**: `LoginView.vue` (email + password) → `useAuth().handleSignin()` → `useAuthStore().signin(email, password)` → `api/auth.js signin()` → `POST /auth/signin` → server sets httpOnly cookies (`access_token` + `refresh_token`) + returns `{ id, name, email }` → stores user data in localStorage → redirects to a validated `?redirect=` target, falling back to `/orgs`. Signup posts `{ name, email, password, confirmation_password }`; `name` is a display name only, `email` is the login identifier. Signup establishes no session, so `handleSignup` forwards to `/login` and carries any `?redirect=` along, keeping an invitation redeemable across the signup → signin detour. `SignupView` also honours `?email=`, prefilling **and disabling** the field — an invitation is bound to its address, so editing it would silently create an unacceptable account.

   **Open-redirect guard**: `?redirect=` is attacker-controllable, so `safeRedirect()` in `composables/useAuth.js` accepts only same-origin relative paths — a single leading `/`, rejecting the protocol-relative `//host` form and the `/\host` variant browsers normalize into it, plus any non-string value (a repeated query key arrives as an array). Anything else falls back.
2. **Token attachment**: Every API call includes `credentials: 'include'` so cookies are sent automatically by the browser
3. **Token refresh**: Automatic on 401 responses. Server rotates both tokens via httpOnly cookies.
4. **Logout**: `UserMenu.vue` → `authStore.logout()` → `POST /auth/logout` (best-effort, cookies sent automatically) → clears all localStorage → redirects to `/login`
5. **Route protection**: `router.beforeEach` calls `authStore.initAuth()` (which calls `GET /auth/me` to verify cookie validity) whenever `authStore.user` is null — once after a successful sign-in, but on **every** navigation while logged out — then checks the `requiresAuth`/`requiresGuest` meta flags
6. **Permission loading**: On entering org-scoped pages, `loadPermissions(orgId)` resolves the user's role and extracts permission name strings for UI gating via `can()` and `canAny()`.

   Call sites may pass a second `userId` argument; it is ignored. `usePermissions.js` names the parameter `_userId` and forwards only `orgId` to `tenantStore.loadPermissions(orgId)` — the tenant store reads the current user from the auth store instead. The parameter survives only because ten view call sites still pass it — do not build on it.

## Store Catalog

| Store                 | File                    | State                                                                                                                      | Key Actions                                                                                                                                                 |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuthStore`        | `stores/auth.js`        | `user`, `loading`; getters `isAuthenticated`, `currentUser`                                                                | `initAuth`, `signup`, `signin`, `logout`                                                                                                                    |
| `useOrgsStore`        | `stores/orgs.js`        | `orgs`, `currentOrg`, `loading`                                                                                            | `fetchOrgs`, `fetchOrgById`, `createOrg`, `updateOrg`, `deleteOrg`, `clearCurrentOrg`                                                                       |
| `useProjectsStore`    | `stores/projects.js`    | `projects`, `currentProject`, `loading`                                                                                    | `fetchProjects`, `fetchProjectById`, `createProject`, `updateProject`, `deleteProject`, `clearCurrentProject`, `clearProjects`                              |
| `useTodosStore`       | `stores/todos.js`       | `todos`, `currentTodo`, `pagination`, `selectedIds`, `sortBy`, `sortOrder`, `searchQuery`, `orgId`, `projectId`, `loading`; getters `hasSelected`, `selectedCount` | `setContext`, `fetchTodos`, `fetchTodoById`, `createTodo`, `updateTodo`, `deleteTodo`, `bulkDelete`, `toggleSelection`, `selectAll`, `clearSelection`, `setSort`, `setSearch`, `clearCurrentTodo`, `clearAll` |
| `useRolesStore`       | `stores/roles.js`       | `roles`, `currentRole`, `allPermissions`, `loading`                                                                        | `fetchRoles`, `fetchRoleById`, `createRole`, `updateRole`, `deleteRole`, `fetchAllPermissions`, `clearRoles`                                                |
| `useMembersStore`     | `stores/members.js`     | `orgMembers`, `projectMembers`, `loading`                                                                                  | `fetchOrgMembers`, `updateOrgMemberRole`, `removeOrgMember`, `fetchProjectMembers`, `updateProjectMemberRole`, `removeProjectMember`, `clearOrgMembers`, `clearProjectMembers` |
| `useInvitationsStore` | `stores/invitations.js` | `orgInvitations`, `myInvitations`, `loading`, `lastAcceptUrl`; getter `pendingCount`                                       | `fetchOrgInvitations`, `fetchMyInvitations`, `inviteToOrg`, `inviteToProject`, `acceptInvitation`, `previewInvitation`, `declineInvitation`, `revokeInvitation`, `resendInvitation`, `clearOrgInvitations`, `clearMyInvitations` |
| `useTenantStore`      | `stores/tenant.js`      | `orgMeta`, `permissions`, `currentOrgId`, `currentProjectId`, `currentOrg`, `currentProject`, `permissionsReady`           | `loadOrgMeta`, `loadAllOrgMeta`, `loadOrgs`, `loadPermissions`, `clear`, `invalidatePermissions`                                                            |

`lastAcceptUrl` holds `response.data.data?.accept_url` from the most recent invite/resend, so the UI can surface the raw link — no mail provider ships with the template.

`tenantStore.loadOrgs()` is a once-per-session guard around `orgsStore.fetchOrgs()`: an internal `orgsRequested` flag means repeated calls (e.g. from every shell mount) issue exactly one request.

**`tenantStore.invalidatePermissions(orgId)`** drops the cached permission set — and the cached org meta — for that org, forcing the next `loadPermissions(orgId)` to refetch. Two stores call it, with deliberately different conditions:

- `stores/roles.js`, after `updateRole`, **unconditionally**. Editing a role's permission set changes what every holder of that role may do, and the store cannot see who holds it.
- `stores/members.js`, after `updateOrgMemberRole` and `updateProjectMemberRole`, **only when the affected `userId` is the signed-in user** (`useAuthStore().user?.id`). Someone else's role change must not blow away the caller's cache. Note that member *removal* does not invalidate — a removed member is not the caller in any flow the SPA offers.

Without this, the SPA keeps rendering actions the API will now reject, and — worse — keeps hiding actions the user has just been granted, until a hard refresh. Any new mutation that can change the caller's own permissions must call it too. It is a no-op when `orgId` is falsy.

## Composable Catalog

| Composable       | File                            | Returns                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuth`        | `composables/useAuth.js`        | `formState`, `error`, `loading`, `isAuthenticated`, `currentUser`, validation rules, `handleSignin`, `handleSignup`, `handleLogout`, `resetForm`                                                                                         |
| `useOrgs`        | `composables/useOrgs.js`        | `orgs`, `currentOrg`, `loading`, modal state (`isModalVisible`, `editingOrg`, `isEditing`), `nameRules`, delegated `fetchOrgs`, `fetchOrgById`, `deleteOrg`, `clearCurrentOrg`, plus `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit` |
| `useProjects`    | `composables/useProjects.js`    | `projects`, `currentProject`, `loading`, modal state (`isModalVisible`, `editingProject`, `isEditing`), `nameRules`, delegated `fetchProjects`, `fetchProjectById`, `deleteProject`, `clearCurrentProject`, `clearProjects`, plus `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit` |
| `useTodos`       | `composables/useTodos.js`       | `todos`, `pagination`, `loading`, `selectedIds`, `hasSelected`, `selectedCount`, `sortBy`, `sortOrder`, `searchQuery`, `currentTodo`, `orgId`, `projectId`, modal state, `titleRules`, `setContext`, `clearAll`, delegated `fetchTodos`, `fetchTodoById`, `deleteTodo`, `bulkDelete`, `clearCurrentTodo`, plus `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit`, `handlePageChange`, `handleSortChange`, `handleSearch`, `handleSelectionChange`, `isSelected` |
| `useRoles`       | `composables/useRoles.js`       | `roles`, `currentRole`, `allPermissions`, `loading`, modal state (`isModalVisible`, `editingRole`, `isEditing`), `nameRules`, delegated `fetchRoles`, `fetchRoleById`, `deleteRole`, `fetchAllPermissions`, `clearRoles`, plus `openCreateModal`, `openEditModal`, `closeModal`, `handleSubmit` |
| `useMembers`     | `composables/useMembers.js`     | `orgMembers`, `projectMembers`, `loading`, role-change modal state (`isRoleModalVisible`, `editingMember`), delegated `fetchOrgMembers`, `fetchProjectMembers`, `clearOrgMembers`, `clearProjectMembers`, plus `openRoleModal`, `closeRoleModal`, `handleRoleChange`, `handleRemove` |
| `useInvitations` | `composables/useInvitations.js` | `orgInvitations`, `myInvitations`, `loading`, `pendingCount`, `lastAcceptUrl`, `isInviteModalVisible`, delegated `fetchOrgInvitations`, `fetchMyInvitations`, `previewInvitation`, `clearOrgInvitations`, `clearMyInvitations`, plus `openInviteModal`, `closeInviteModal`, `handleInvite`, `handleAccept`, `handleDecline`, `handleRevoke`, `handleResend` |
| `usePermissions` | `composables/usePermissions.js` | `userPermissions`, `can(permission)`, `canAny(permissions[])`, `loadPermissions(orgId)`, `clearPermissions`                                                                                                                              |

Note the split visible in every row: state is re-exposed as `computed()` (read-only to the view), pure store actions are **delegated by reference**, and only the wrappers that add modal state or a confirmation live in the composable itself. The `clear*` family is pure delegation — it lets a view reset store state without importing the store (`TodoDetailView` calls `clearCurrentTodo()` when the `:id` route param disappears). Most of the family is currently re-exported but unused by any view; keep it wired rather than assuming it is dead.

## Component Catalog

| Component          | File                              | Purpose                                                                                                                            |
| ------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`         | `components/AppShell.vue`         | Application shell: sider or drawer, top bar, breadcrumb, routed content                                                            |
| `SideNav`          | `components/SideNav.vue`          | Permission-filtered navigation menu, org- or project-scoped by route                                                               |
| `TopBar`           | `components/TopBar.vue`           | 56px header: org and project switchers, invitations bell, user menu                                                                |
| `OrgSwitcher`      | `components/OrgSwitcher.vue`      | Org dropdown with member counts and the caller's role                                                                              |
| `ProjectSwitcher`  | `components/ProjectSwitcher.vue`  | Project dropdown, hidden when no project is selected                                                                               |
| `InvitationsBell`  | `components/InvitationsBell.vue`  | Pending-invitation badge linking to `/invitations`                                                                                 |
| `UserMenu`         | `components/UserMenu.vue`         | Avatar dropdown with the signed-in user and Logout                                                                                 |
| `AppBreadcrumb`    | `components/AppBreadcrumb.vue`    | Org / project / page trail                                                                                                         |
| `OrgFormModal`     | `components/OrgFormModal.vue`     | Create/edit organization modal form (name + description)                                                                           |
| `ProjectFormModal` | `components/ProjectFormModal.vue` | Create/edit project modal form (name + description)                                                                                |
| `TodoFormModal`    | `components/TodoFormModal.vue`    | Create/edit todo modal form (title + description + completed checkbox)                                                             |
| `RoleFormModal`    | `components/RoleFormModal.vue`    | Create/edit role modal with permissions grouped by resource as checkboxes                                                          |
| `InviteFormModal`  | `components/InviteFormModal.vue`  | Invite member modal — email input with role selection dropdown                                                                     |
| `MembersTable`     | `components/MembersTable.vue`     | Members table — Name, Email, Role, Joined (`joined_at`), Actions. Role renders an inline change dropdown when `canUpdateRole`, otherwise a static tag; Actions is appended only when `canRemove` and holds a Popconfirm-guarded remove button |
| `InvitationsTable` | `components/InvitationsTable.vue` | Invitations table with color-coded status tags and revoke button for pending invitations                                           |

## Design System & Theme

- **`src/assets/design-system/`**: a byte-identical copy of the design system's tokens, fonts and base stylesheet (`styles.css`). It is copied, not authored here, so `.prettierignore` excludes it — Prettier reformatting it would make future re-syncs from the source design system show a full-file diff instead of a real one.
- **`src/theme/antd.js`**: exports `antdTheme`, the token object handed to `ConfigProvider` in `App.vue`. Every value is annotated with the design-system custom property it mirrors (e.g. `colorPrimary: "#0e7c72" // --teal-500`), and `theme/antd.test.js` asserts the two stay in agreement. Component-level tokens (`Layout`, `Menu`) are overridden by their v5 internal names, read from `node_modules/ant-design-vue/es/<component>/style/index.d.ts` rather than the current antd React docs, which describe a newer schema.
- **Import order in `main.js` is load-bearing**: `ant-design-vue/dist/reset.css`, then `@/assets/design-system/styles.css`, then `@/assets/app.css`, so app-level overrides always win over both antd's reset and the design system's base styles.

## API Service Catalog

| Module         | File                    | Exports                                                                                                                                  |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| auth           | `api/auth.js`           | `signup`, `signin`, `getMe`, `refreshToken`, `logout`                                                                                    |
| orgs           | `api/orgs.js`           | `getOrgs`, `getOrg`, `createOrg`, `updateOrg`, `deleteOrg`                                                                               |
| projects       | `api/projects.js`       | `getProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`                                                           |
| todos          | `api/todos.js`          | `getTodos`, `getTodoById`, `createTodo`, `updateTodo`, `deleteTodo`, `deleteTodos`                                                       |
| roles          | `api/roles.js`          | `getRoles`, `getRole`, `createRole`, `updateRole`, `deleteRole`                                                                          |
| permissions    | `api/permissions.js`    | `getPermissions`                                                                                                                         |
| invitations    | `api/invitations.js`    | `inviteToOrg`, `inviteToProject`, `listOrgInvitations`, `listMyInvitations`, `acceptInvitation`, `previewInvitation`, `declineInvitation`, `revokeInvitation`, `resendInvitation` |
| orgMembers     | `api/orgMembers.js`     | `getOrgMembers`, `updateOrgMemberRole`, `removeOrgMember`                                                                                |
| projectMembers | `api/projectMembers.js` | `getProjectMembers`, `updateProjectMemberRole`, `removeProjectMember`                                                                    |

Two invitation exports are easy to miss because they sit outside the ordinary CRUD shape:

- `previewInvitation(invitationId, token)` → `GET /invitations/:id/preview?token=` — the public, token-gated endpoint backing the `/invite/:invitationId` landing page. It is a `request.get` with the token as a **query param**, not a body.
- `resendInvitation(orgId, invitationId)` → `POST /orgs/:orgId/invitations/:id/resend` — reissues the token and expiry, invalidating the previous link, and returns the new `accept_url`.

**`api/roles.js` remaps the permissions key.** The private `toRequestBody({ permissions, ...rest })` helper renames the form-layer `permissions` key to the API's `permission_ids`, and omits the key entirely when `permissions` is `undefined` (so renaming a role sends no spurious key). `createRole` and `updateRole` both route their body through it. A role request built from the store shape without this helper sends the wrong key and silently assigns no permissions. Covered by `api/roles.test.js`.

## Utility Files

| File               | Exports                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `utils/http.js`    | `baseURL` (const), `HttpError` (class), `request` object (`send`, `get`, `post`, `put`, `del`) |
| `utils/storage.js` | `getUserData`, `setUserData`, `clearUserData`                                                  |

## Environment Configuration

- `VITE_API_BASE_URL` — backend API base URL. Read once at module load in `utils/http.js`; there is **no code-level default**. If it is unset, `baseURL` is `undefined` and every request URL becomes `"undefined/orgs"`. The `http://localhost:3000/api` value lives only in `.env.example`, so a fresh clone that skips the copy step fails this way.
- Copy `.env.example` to `.env` to configure

## Testing

- **Runner**: Vitest with `globals: true` and `environment: "jsdom"`
- **Config**: `vitest.config.js` merges `vite.config.js` so the `@` alias has one definition. `vite.config.js` exports a function, so it is invoked as `viteConfig(configEnv)` before merging.
- **Component mounting**: `@vue/test-utils`
- **Include glob**: `src/**/*.test.js` — tests live beside the code they cover
- **Lint**: the `app/test-files` block in `eslint.config.js` registers the Vitest globals (`describe`, `it`, `expect`, `vi`, the `before*`/`after*` hooks) for `**/*.test.js`
- **Mocking convention**: mock exactly one boundary, `@/utils/http`. Composables, stores, and API service modules run for real, so a wrong argument order anywhere in the view → composable → store → api chain fails the test. Mocking `@/api/*` or `@/stores/*` defeats this and should not be done.
- **Also mocked**: `vue-router` (composables call `useRouter()` at setup) and `ant-design-vue`'s `message` (stores call `message.success`). `@/utils/storage` is left real — jsdom provides `localStorage`. Component tests that mount an Ant Design Vue grid must stub `window.matchMedia`, which jsdom does not implement.
- **Pinia**: store and composable tests call `setActivePinia(createPinia())` in `beforeEach`; component tests pass a fresh pinia via `mount(..., { global: { plugins: [createPinia()] } })`
- **Coverage**: 27 spec files, colocated with the code they cover, spanning `api/`, `components/`, `composables/`, `router/`, `stores/`, `theme/`, `utils/`, and `views/` (auth, invitations, orgs, projects). Do not maintain a filename list here — it drifts; run `git ls-files 'src/**/*.test.js'` for the current set.

## Code Style

- **Linting**: Dual-linter setup with oxlint (fast) then eslint (comprehensive) via npm-run-all2
- **Formatting**: Prettier with semicolons disabled, double quotes, 100 char width
- **Import alias**: `@` maps to `src/` directory

## File Naming

- Views: `*View.vue` (e.g., `LoginView.vue`, `TodosListView.vue`)
- Components: PascalCase (e.g., `AppShell.vue`, `TodoFormModal.vue`)
- Stores: camelCase with `use` prefix (e.g., `useAuthStore`)
- Composables: camelCase with `use` prefix (e.g., `useAuth`, `useTodos`)
- API modules: camelCase (e.g., `auth.js`, `orgMembers.js`)
