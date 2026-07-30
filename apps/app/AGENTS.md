# AGENTS.md

Guidance for agents working in `apps/app`. This file holds facts and invariants; the command
listing, setup steps and project tree live in [`README.md`](README.md), and a worked
feature-building tutorial is in [`TEMPLATE_GUIDE.md`](TEMPLATE_GUIDE.md).

## Architecture Overview

Vue 3 SPA built with Vite, using a Pinia store + composables pattern for state management. The app implements cookie-based authentication with automatic token refresh via a custom fetch-based HTTP client (httpOnly cookies set by the server).

- **Vue 3** with Composition API, TypeScript throughout (`<script setup lang="ts">`)
- **Pinia** for state management (composition API setup syntax)
- **Ant Design Vue** for UI components
- **Native fetch API** for HTTP requests (custom client in `src/utils/http.ts`)
- **Vue Router** with navigation guards

The dev server runs on port 8080 (`server.port` in `vite.config.ts`), which must match the API's
`CORS_ALLOWED_ORIGINS`.

### Layered architecture

Each layer talks only to the one below it: `views/` → `composables/` → `stores/` → `api/` →
`utils/http.ts`. Views hold no HTTP calls and stores hold no modal state. `theme/antd.ts` feeds
`ConfigProvider` in `App.vue`; `assets/design-system/` is a vendored copy (see below). The
catalogs of what exists in each directory are recoverable with `ls src/<layer>/` — what follows is
only the part the filesystem does not tell you.

## Routing

Routes are declared in `src/router/index.ts`; read that file for the current table. Legacy `?tab=`
URLs redirect to the matching route via a `beforeEnter` guard (`redirectLegacyTab`, applied to
`OrgSettings` and `ProjectSettings`).

**`meta.permission` is declarative only.** The header comment in `router/index.ts` states that route-level *enforcement* is not implemented in this release — the field records intent for a future guard and does **not** gate navigation today. `SideNav` hides nav items the user lacks, but it does so from its **own** `permission` field on each nav entry — a hand-maintained mirror of the router's, not a read of `route.meta`. Keep the two in step. Access control itself is enforced server-side by `PermissionsGuard`, and the SPA hides actions via `usePermissions`, not via the router. Do not read those `meta.permission` values as "the router blocks these routes".

`/orgs`, `/invitations`, `/login`, `/signup`, and `/invite/:invitationId` carry no `meta.permission` at all. `OrgRoles` gates on `org:read` rather than `org:manage_roles` on purpose — listing roles needs only `org:read` on the API side; editing is gated separately, in-template, on `org:manage_roles`.

**Navigation guard**: Unauthenticated users on `requiresAuth` routes are redirected to `/login` with `?redirect=`. Authenticated users on `requiresGuest` routes are redirected to `/orgs`. Routes carrying **neither** flag are public in any session state — the guard only acts on those two meta flags. `/invite/:invitationId` relies on that deliberately: `requiresAuth` would bounce a brand-new invitee to `/login` before they could see what they were invited to, and `requiresGuest` would bounce a signed-in user to `/orgs` before they could accept. Auth store is initialized on first navigation via `GET /auth/me`.

**Invite landing page**: `/invite/:invitationId?token=<64hex>` reads the token from the query string, calls the public preview endpoint, and renders one of `loading | no-token | invalid | expired | handled | guest | wrong-account | ready`. Arriving without `?token=` short-circuits to `no-token`, which is deliberately distinct from `invalid` — "no credential supplied" is not "credential rejected", and the in-app invitation list links here by id without a token, so telling those users the invitation is invalid would be a lie. That is also why `MyInvitationsView`'s primary action is **"Open invitation"** (navigation to `/invite/:id`) rather than "Accept": that view has no token and cannot redeem directly. Decline still works there, since declining requires no token.

**Reading params: `String(route.params.x)` in views, `paramToString` where absence is real.** vue-router types `params` as `string | string[]` because repeatable segments (`:id+`) yield arrays, and this app declares none. A view reached only through a route that owns the segment already knows the param is there, so `String(...)` is the honest narrowing. `paramToString` in `utils/route-params.ts` returns `string | null` and is reserved for the places where the param genuinely may be missing — `tenantStore`'s `currentOrgId` and `currentProjectId`, which read `router.currentRoute` from any route in the app, including ones with no `:orgId` at all. Reaching for `paramToString` inside a view only pushes a null branch into code that cannot reach it.

## HTTP Client (`src/utils/http.ts`)

Custom fetch-based client (NOT Axios). Key behaviors:

- **Base URL**: `VITE_API_BASE_URL` **plus the API version segment**, read once at module load in `utils/http.ts` (``export const baseURL = `${import.meta.env.VITE_API_BASE_URL}/v1` ``). There is **no code-level default** for the env var — if it is unset, `baseURL` is `"undefined/v1"` and every request URL becomes `"undefined/v1/orgs"`. The `http://localhost:3000/api` value lives only in `.env.example`, so a fresh clone that skips `cp .env.example .env` fails this way. Note that `VITE_API_BASE_URL` stops at `/api`: the `/v1` is appended here and **nowhere else**.
- **The version belongs in `baseURL` only — never at a call site.** Every request URL is `` `${baseURL}${url}` ``, and `NO_RETRY_ENDPOINTS` / `NO_REDIRECT_ENDPOINTS` match the **bare** `url` argument with `.includes()`. Writing `/v1/auth/refresh` at a call site would produce `/api/v1/v1/auth/refresh` *and* silently stop matching those lists, disabling the refresh-retry and redirect suppression that break the reload loop described below. `http.version.test.ts` pins the invariant.
- **Timeout**: 10 seconds via `AbortController` (`DEFAULT_TIMEOUT`, overridable per request)
- **Auth cookies**: `credentials: 'include'` on all fetch calls, cookies set by server
- **Token refresh flow**: On 401 responses:
  1. Queues concurrent requests in `failedQueue` to prevent refresh race conditions
  2. Sends refresh request (cookie-based) to `POST /auth/refresh`
  3. On success: server rotates and sets new httpOnly cookies, replays queued requests
  4. On refresh failure: calls `clearUserData()`, then redirects to `/login` **unless** the failing request URL matches `NO_REDIRECT_ENDPOINTS` (`/auth/me`) or the browser is already on a path in `AUTH_PATHS` (`/login`, `/signup`). Both guards exist to break an infinite reload loop — `/auth/me` is the session probe `initAuth` fires — and while logged out `authStore.user` stays null, so the router guard re-fires it on *every* navigation — meaning a redirect on its failure re-triggers the probe on load, forever. A separate `NO_RETRY_ENDPOINTS` list (`/auth/signin`, `/auth/signup`, `/auth/refresh`) suppresses the refresh-retry itself; the two lists are different lists with different jobs.
- **Error handling**: Non-401 errors trigger `message.error()` toast automatically
- **Exports**: `baseURL` (const), `HttpError` (class), `request` (object with `send`, `get`, `post`, `put`, `del`), plus the types `HttpMethod`, `QueryParams`, `RequestOptions` and `HttpResult<E>`. `send<E>()` and the four convenience methods are generic in the **envelope**, not the payload: an `api/` module writes `request.get<Envelope<Wire<Todo>>>(...)` and the caller reads `response.data.data`, so the type argument matches what the server puts on the wire rather than what the store wants out of it. `HttpResult<E>` is the axios-shaped `{ data: E, status }` wrapper — `E` is the envelope, which is why the unwrap below is two `.data`s deep in the types as well as at runtime.
- **Request/response casing**: the API contract is snake_case throughout and the client does no conversion — stores consume the keys verbatim. Query params on paginated lists are `page`, `limit`, `sort_by`, `sort_order`, `search`. The pagination envelope is `current_page`, `total_pages`, `total_items`, `items_per_page`, `has_next_page`, `has_previous_page`, `next_page`, `previous_page`. Body fields follow the same rule: `is_completed`, `role_id`, `permission_ids`, `confirmation_password`. Response and path names do too: `user_id`, `role_name`, `joined_at`, `accept_url`.
- **Unwrap depth**: `send()` returns an axios-shaped `{ data, status }`, and the server envelope is `{ message, data, pagination? }`, so a payload is `response.data.data` — **not** `response.data.data.<resource>`. Every store unwraps at that depth; paginated lists read `response.data.pagination` alongside it.

## Authentication Flow

1. **Signin**: `LoginView.vue` (email + password) → `useAuth().handleSignin()` → `useAuthStore().signin(email, password)` → `api/auth.ts signin()` → `POST /auth/signin` → server sets httpOnly cookies (`access_token` + `refresh_token`) + returns `{ id, name, email }` → stores user data in localStorage → redirects to a validated `?redirect=` target, falling back to `/orgs`. Signup posts `{ name, email, password, confirmation_password }`; `name` is a display name only, `email` is the login identifier. Signup establishes no session, so `handleSignup` forwards to `/login` and carries any `?redirect=` along, keeping an invitation redeemable across the signup → signin detour. `SignupView` also honours `?email=`, prefilling **and disabling** the field — an invitation is bound to its address, so editing it would silently create an unacceptable account.

   **Open-redirect guard**: `?redirect=` is attacker-controllable, so `safeRedirect()` in `composables/useAuth.ts` accepts only same-origin relative paths — a single leading `/`, rejecting the protocol-relative `//host` form and the `/\host` variant browsers normalize into it, plus any non-string value (a repeated query key arrives as an array). Anything else falls back.
2. **Token attachment**: Every API call includes `credentials: 'include'` so cookies are sent automatically by the browser
3. **Token refresh**: Automatic on 401 responses. Server rotates both tokens via httpOnly cookies.
4. **Logout**: `UserMenu.vue` → `authStore.logout()` → `POST /auth/logout` (best-effort, cookies sent automatically) → clears all localStorage → redirects to `/login`
5. **Route protection**: `router.beforeEach` calls `authStore.initAuth()` (which calls `GET /auth/me` to verify cookie validity) whenever `authStore.user` is null — once after a successful sign-in, but on **every** navigation while logged out — then checks the `requiresAuth`/`requiresGuest` meta flags
6. **Permission loading**: On entering org-scoped pages, `loadPermissions(orgId)` resolves the user's role and extracts permission name strings for UI gating via `can()` and `canAny()`.

   Call sites may pass a second `userId` argument; it is ignored. `usePermissions.ts` names the parameter `_userId` and forwards only `orgId` to `tenantStore.loadPermissions(orgId)` — the tenant store reads the current user from the auth store instead. The parameter survives only because view call sites still pass it (`grep -rn 'loadPermissions(' src/views/`) — do not build on it.

## Stores

Eight Pinia setup stores in `src/stores/`; the file exports a `use<Name>Store` factory (`stores/auth.ts` → `useAuthStore`). Read the file for its state and actions. What the source does not make obvious:

`lastAcceptUrl` (in `stores/invitations.ts`) holds `response.data.data?.accept_url` from the most recent invite/resend, so the UI can surface the raw link — no mail provider ships with the template.

`tenantStore.loadOrgs()` is a once-per-session guard around `orgsStore.fetchOrgs()`: a module-scope `orgsRequested` flag means repeated calls (e.g. from every shell mount) issue exactly one request. The flag is a bare `let` outside the store body, so it does not appear in the store's returned object.

**`tenantStore.invalidatePermissions(orgId)`** drops the cached permission set — and the cached org meta — for that org, forcing the next `loadPermissions(orgId)` to refetch. Two stores call it, with deliberately different conditions:

- `stores/roles.ts`, after `updateRole`, **unconditionally**. Editing a role's permission set changes what every holder of that role may do, and the store cannot see who holds it.
- `stores/members.ts`, after `updateOrgMemberRole` and `updateProjectMemberRole`, **only when the affected `userId` is the signed-in user** (`useAuthStore().user?.id`). Someone else's role change must not blow away the caller's cache. Note that member *removal* does not invalidate — a removed member is not the caller in any flow the SPA offers.

Without this, the SPA keeps rendering actions the API will now reject, and — worse — keeps hiding actions the user has just been granted, until a hard refresh. Any new mutation that can change the caller's own permissions must call it too. It is a no-op when `orgId` is falsy.

## Composables

Eight composables in `src/composables/`, one per domain plus `usePermissions`. The split is visible in every one: state is re-exposed as `computed()` (read-only to the view), pure store actions are **delegated by reference**, and only the wrappers that add modal state or a confirmation live in the composable itself. The `clear*` family is pure delegation — it lets a view reset store state without importing the store (`TodoDetailView` calls `clearCurrentTodo()` when the `:id` route param disappears). Most of the family is currently re-exported but unused by any view; keep it wired rather than assuming it is dead.

## Components

Fifteen components in `src/components/`; names are self-describing and the files are short. Two contracts worth stating:

`MembersTable` renders Name, Email, Role, Joined (`joined_at`), Actions. Role renders an inline change dropdown when `canUpdateRole`, otherwise a static tag; the Actions column is **appended only when `canRemove`** and holds a Popconfirm-guarded remove button. A caller that forgets those props silently gets a read-only table. This one is conditional rather than structural, which is why it is not visible from the props alone.

**Never pass a `#bodyCell` `record` straight to a typed handler.** Ant Design Vue hard-types that slot prop as `Record<string, any>` and the `Table` component is not generic over its row type, so the row arrives at the slot boundary with every field typed `any` and matching no named shape. Handlers therefore take `record.id` — a `string` — and look the row up in the table's own `data-source` (`TodosListView`'s `editTodo`, `OrgRolesView`'s `editRole`, `MyInvitationsView`'s `goToInvite`). That recovers the real object with no cast, which is the only reason `src/` still contains zero assertions. Passing `record` wholesale compiles, because `any` assigns to anything, and hands the handler an unvalidated object.

## Design System & Theme

- **`src/assets/design-system/`**: a byte-identical copy of the design system's tokens, fonts and base stylesheet (`styles.css`). It is copied, not authored here, so `.prettierignore` excludes it — Prettier reformatting it would make future re-syncs from the source design system show a full-file diff instead of a real one.
- **`src/theme/antd.ts`**: exports `antdTheme`, typed as antd's `ThemeConfig`. It is the token object handed to `ConfigProvider` in `App.vue`. Every value is annotated with the design-system custom property it mirrors (e.g. `colorPrimary: "#0e7c72" // --teal-500`), and `theme/antd.test.ts` asserts the two stay in agreement. Component-level tokens (`Layout`, `Menu`) are overridden by their v5 internal names, read from `node_modules/ant-design-vue/es/<component>/style/index.d.ts` rather than the current antd React docs, which describe a newer schema. Typing the object surfaced that `fontFamilyCode` is not in 4.2.6's token interfaces at all — antd React added it in a later 5.x than this port tracks, so it is silently dropped and renders nothing. It is kept behind a `@ts-expect-error` rather than removed, because removing it would fail the token test and picking the real mechanism is a behaviour change.
- **Import order in `main.ts` is load-bearing**: `ant-design-vue/dist/reset.css`, then `@/assets/design-system/styles.css`, then `@/assets/app.css`, so app-level overrides always win over both antd's reset and the design system's base styles.

## API Service Layer

One module per resource in `src/api/`, each a thin wrapper over `utils/http.ts`. Each module also owns its own request types (`OrgInput`, `ProjectInput`, `TodoInput`, `InviteInput`, `RoleFormInput`, `TodoListParams`): those describe what the client *sends*, which `@fullstack/contracts` does not model — the contracts package holds response entities only. Anything passed as query params must be a `type` alias and not an `interface`: `request.get` takes `QueryParams`, an index-signature record, and TypeScript grants an object type alias the implicit index signature it needs to satisfy that while refusing it to an interface. `TodoListParams` is a `type` for exactly this reason. Three exports sit outside the ordinary CRUD shape:

- `previewInvitation(invitationId, token)` → `GET /invitations/:id/preview?token=` — the public, token-gated endpoint backing the `/invite/:invitationId` landing page. It is a `request.get` with the token as a **query param**, not a body.
- `acceptInvitation(invitationId, token)` → `POST /invitations/:id/accept` — the raw token goes in the **body**; `AcceptInvitationDto` rejects the call with a 400 without it.
- `resendInvitation(orgId, invitationId)` → `POST /orgs/:orgId/invitations/:id/resend` — reissues the token and expiry, invalidating the previous link, and returns the new `accept_url`.

**`api/roles.ts` remaps the permissions key.** The private `toRequestBody({ permissions, ...rest })` helper renames the form-layer `permissions` key to the API's `permission_ids`, and omits the key entirely when `permissions` is `undefined` (so renaming a role sends no spurious key). `createRole` and `updateRole` both route their body through it. A role request built from the store shape without this helper sends the wrong key and silently assigns no permissions. Covered by `api/roles.test.ts`.

## Environment Configuration

`VITE_API_BASE_URL` is the only variable; its failure mode is described under [HTTP Client](#http-client-srcutilshttpts). `env.d.ts` declares it on `ImportMetaEnv` so `import.meta.env.VITE_API_BASE_URL` is a `string` rather than `any`. Declaring a new variable there is worth doing but is not a gate: Vite's own `ImportMetaEnv` extends `Record<string, any>` unless `ViteTypeOptions.strictImportMetaEnv` is set, which this package does not set, so an undeclared `import.meta.env.VITE_ANYTHING` still type-checks as `any`. Setup is in [`README.md`](README.md).

## TypeScript

- **Four tsconfigs, create-vue style.** `tsconfig.json` is a solution file with `files: []` and three
  references and compiles nothing itself; `tsconfig.app.json` covers `env.d.ts` plus `src/**/*.ts`
  and `src/**/*.vue` under `strict`, excluding both `src/**/*.test.ts` **and `src/test/**`**;
  `tsconfig.node.json` covers `vite.config.ts` and `vitest.config.ts`; `tsconfig.vitest.json`
  extends the app config, re-includes `src/**/*.test.ts` **and `src/test/**/*.ts`**, and adds the
  `vitest/globals` types. Because it is a project-references build, the checker is `vue-tsc -b` — a
  bare `tsc` on any one file checks it against the wrong config. That second pair of globs is what
  makes `src/test/` the home for test-only helpers such as `fixtures.ts`: everything under it is
  checked with the Vitest types and never as part of the shipping app program, so a helper may use
  `vitest/globals` and the `node` types freely without leaking either into browser code.
- **`node` types live only in `tsconfig.node.json` and `tsconfig.vitest.json`.** `tsconfig.app.json`
  declares `types: ["vite/client"]` and nothing else on purpose. Adding `node` there would pull the
  Node globals into browser code: `setTimeout` in `utils/http.ts` starts returning `NodeJS.Timeout`
  rather than a `number`, and `process` / `Buffer` start type-checking in files that will not have
  them at runtime. The compiler goes quiet and the browser does not.
- **`allowJs` is absent and every glob is `.ts`-only** — in `tsconfig.app.json`,
  `tsconfig.vitest.json`, `vitest.config.ts`'s `include`, and the `app/test-files` block in
  `eslint.config.js`. `configureVueProject({ scriptLangs: ["ts"] })` is the SFC-side twin: an
  `<script setup>` without `lang="ts"` is a lint error. What this actually catches is an *imported*
  `.js` file — `TS7016: could not find a declaration file`. An orphan `.js` that nothing imports is
  simply not in the program and passes. The command that enforces it is `typecheck`
  (`vue-tsc -b --force`); `build` only catches it because that script is `vue-tsc -b && vite build`.
  `vite build` on its own never type-checks. `eslint.config.js` is the one deliberate `.js` left in
  the package, and it is still linted.
- **Wire types, not entity types.** API responses are JSON, so `Date` fields arrive as strings.
  Stores, composables and views consume `Wire<Entity>` from `@fullstack/contracts`, a recursive
  mapped type that rewrites `Date` → `string` through arrays and nested objects. Annotating a store
  with the bare entity type compiles against the contract and lies about the data — `created_at`
  would appear to be a `Date` and `.getTime()` would blow up at runtime.
- **Two type escapes survive, each with a written justification** — the tree is not escape-free
  and should not be "cleaned up" without reading them. `theme/antd.ts` suppresses `fontFamilyCode`
  (see above); `InviteFormModal.vue`'s `handleOk` suppresses a `string | undefined` → `string`
  assignment that the form's required rule makes unreachable. Both `@ts-expect-error` directives
  self-clear as unused-directive errors if the underlying types ever change. Beyond those, `src/`
  contains no `any`, no `as`, and no non-null assertions; the remaining `TODO(ts-migration)` markers
  flag findings, not suppressions.

## Testing

- **Runner**: Vitest with `globals: true` and `environment: "jsdom"`
- **Config**: `vitest.config.ts` merges `vite.config.ts` so the `@` alias has one definition. `vite.config.ts` exports a function, so it is invoked as `viteConfig(configEnv)` before merging.
- **Include glob**: `src/**/*.test.ts` — tests live beside the code they cover
- **Lint**: the `app/test-files` block in `eslint.config.js` registers the Vitest globals (`describe`, `it`, `expect`, `vi`, the `before*`/`after*` hooks) for `**/*.test.ts`
- **Mocking convention**: mock exactly one boundary, `@/utils/http`. Composables, stores, and API service modules run for real, so a wrong argument order anywhere in the view → composable → store → api chain fails the test. Mocking `@/api/*` or `@/stores/*` defeats this and should not be done.
- **Also mocked**: `vue-router` (composables call `useRouter()` at setup) and `ant-design-vue`'s `message` (stores call `message.success`). `@/utils/storage` is left real — jsdom provides `localStorage`. Component tests that mount an Ant Design Vue grid must stub `window.matchMedia`, which jsdom does not implement.
- **Pinia**: store and composable tests call `setActivePinia(createPinia())` in `beforeEach`; component tests pass a fresh pinia via `mount(..., { global: { plugins: [createPinia()] } })`
- **Coverage**: specs are colocated with the code they cover, spanning `api/`, `components/`, `composables/`, `router/`, `stores/`, `theme/`, `utils/`, and `views/`. Do not maintain a filename list or a count here — both drift; run `git ls-files 'src/**/*.test.ts'` for the current set.
- **Typing the mock**: the mock is installed as `vi.mock("@/utils/http", () => ({ ... }))` with a factory, then reached through `vi.mocked(request.get)` rather than a cast — that is what keeps the stub typed against the real export and is why `src/` still holds no `as`. Test files are covered by `tsconfig.vitest.json`, not by `tsconfig.app.json`, which excludes them; `typecheck` builds all three project references, so it checks the tests too.
- **Build mocked responses through `src/test/fixtures.ts`, never as object literals.** `vi.mocked()` instantiates the http client's envelope generic at `unknown`, so `data` is unconstrained and a payload that no longer matches its contract still compiles — the exact drift the TypeScript migration was meant to catch. The module exports a `make<Entity>()` factory per contract type (`makeUser`, `makeOrg`, `makeProject`, `makeTodo`, `makePermission`, `makeRole`, `makeOrgMember`, `makeProjectMember`, `makePaginationMeta`, and the invitation family below), each returning a complete `Wire<T>`, plus `ok(data)` and `okPaginated(rows, pagination?)` which supply the two-deep envelope (`response.data.data`) and the `status: 200` that `vi.mocked()` makes mandatory. Pass overrides for the fields a test asserts on; take the defaults for the rest — `AT` is the one frozen timestamp every factory dates from, so comparisons never depend on the clock. `makeInvitationWithToken`, `makeInvitationListItem` and `makeMyInvitation` all spread `makeInvitation`, but `makeInvitationPreview` deliberately does **not** — the public, token-gated preview endpoint withholds `org_id`, `inviter_id` and `role_id` from logged-out callers, and a fixture that supplied them would let a spec assert on data the endpoint never sends. Do not "simplify" it into a spread.

## File Naming

- Views: `*View.vue`; components PascalCase; api modules and stores camelCase filenames.
- Stores and composables export a `use`-prefixed factory — the filename is the bare domain
  (`stores/auth.ts` exports `useAuthStore`, `composables/useAuth.ts` exports `useAuth`).
