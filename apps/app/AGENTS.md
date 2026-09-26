# AGENTS.md

Facts and invariants for `apps/app`. Commands, setup and the project tree are in
[`README.md`](README.md).

## Scope

Vue 3 + Vite + TypeScript SPA. Pinia setup stores, composables, shadcn-vue on reka-ui and Tailwind
CSS v4, Vue Router, and a custom fetch client in `src/utils/http.ts`. The dev server port 8080 must match the API's
`CORS_ALLOWED_ORIGINS`.

## Layers

`views/` → `composables/` → `stores/` → `api/` → `utils/http.ts`. Each layer calls only the one
below it. Views hold no HTTP calls. Stores hold no modal state. Composables expose state as
`computed()` and delegate pure store actions by reference. Run `ls src/<layer>/` for the catalog.

## HTTP client

- `baseURL` is `${VITE_API_BASE_URL}/v1`. **The `/v1` lives here and nowhere else.** A call-site
  path such as `/v1/auth/refresh` doubles the segment and stops matching `NO_RETRY_ENDPOINTS` and
  `NO_REDIRECT_ENDPOINTS`.
- `VITE_API_BASE_URL` has no code default. When unset, every URL starts with `undefined/v1`.
- On 401 the client queues requests, calls `POST /auth/refresh`, and replays them. On refresh
  failure it clears the user data and redirects to `/login`, except for `/auth/me` and when the
  browser is already on `/login` or `/signup`. Both exceptions break a reload loop.
- The payload is `response.data.data`. Paginated lists read `response.data.pagination`. The type
  argument is the envelope: `request.get<Envelope<Wire<Todo>>>()`.
- The wire contract is snake_case. The client does no conversion.
- A query-param type must be a `type` alias, not an `interface`, to satisfy `QueryParams`.

## Routing and auth

- **`meta.permission` is declarative only.** Nothing enforces it. `SideNav` keeps its own mirror of
  it. Keep the two in step. UI gating is `usePermissions` (`can`, `canAny`). Enforcement is
  server-side.
- The guard acts only on `requiresAuth` and `requiresGuest`. A route with neither flag is public in
  every session state. `/invite/:invitationId` depends on this.
- `authStore.initAuth()` (`GET /auth/me`) runs on every navigation while `user` is null.
- `safeRedirect()` in `composables/useAuth.ts` accepts only a relative path with one leading `/`.
- Signup creates no session. `handleSignup` forwards to `/login` and keeps `?redirect=`.
  `SignupView` prefills and disables the email field from `?email=`.
- Read route params with `String(route.params.x)` in views. Use `paramToString` only where the
  param can be absent (`tenantStore`).
- Any mutation that can change the caller's own permissions must call
  `tenantStore.invalidatePermissions(orgId)`. `roles.ts` calls it after every `updateRole`.
  `members.ts` calls it only when the affected user is the signed-in user.
- `loadPermissions(orgId, userId?)` ignores the second argument. Do not build on it.

## Components and theme

- `src/components/ui/` holds generated shadcn-vue components. Add one with
  `corepack pnpm dlx shadcn-vue@latest add <name>`. The app lint rules do not apply to this folder.
- Theme tokens live in `src/assets/tailwind.css`. It is the only stylesheet import. The `.dark`
  block is unused because nothing toggles dark mode.
- The status tokens `success`, `warning` and `info` are for `Badge` variants only.
- Forms use VeeValidate with Zod schemas in `src/schemas/`.
- Toasts come from `vue-sonner`. The `Toaster` is mounted once in `App.vue`.
- `eslint.config.js` bans imports of `ant-design-vue` and `@ant-design/icons-vue` in `src/`. Use
  `@lucide/vue` for icons.
- Form modals take an `open` prop, not `visible`.
- `MembersTable` shows the Actions column only when `canRemove`, and the role Select only when
  `canUpdateRole`.
- `api/roles.ts` maps the form key `permissions` to the wire key `permission_ids` in
  `toRequestBody`.

## TypeScript

- Four tsconfigs: the solution file plus `app`, `node` and `vitest`. Check with `vue-tsc -b`, never
  bare `tsc`. `src/test/` is covered only by `tsconfig.vitest.json`.
- `node` types belong only in `tsconfig.node.json` and `tsconfig.vitest.json`. Never add them to
  `tsconfig.app.json`.
- `allowJs` is absent, every glob is `.ts`-only, and `<script setup>` needs `lang="ts"`.
  `eslint.config.js` is the one deliberate `.js`.
- Consume `Wire<Entity>` from `@fullstack/contracts`, never the bare entity type. `Date` fields
  arrive as strings.
- `src/` has no `any`, no `as` and no `!`, except in the vendored `src/components/ui/` folder and in
  test files. No `@ts-expect-error` directive remains.

## Testing

- Vitest, jsdom, `globals: true`. Tests live in `__tests__/` beside the code. Glob:
  `src/**/*.test.ts`.
- **Mock exactly one boundary: `@/utils/http`.** Composables, stores and api modules run for real.
  Also mock `vue-router` and `vue-sonner`:
  `vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))`. Leave
  `@/utils/storage` real.
- Build mocked responses with the factories in `src/test/fixtures.ts` (`makeX`, `ok`,
  `okPaginated`), never with object literals. `makeInvitationPreview` deliberately does not spread
  `makeInvitation`.
- Reach the mock through `vi.mocked(request.get)`, not a cast.
- `src/test/setup.ts` stubs `matchMedia`, `ResizeObserver`, `scrollIntoView` and
  `hasPointerCapture` for every test. Do not stub them again, except to pick a viewport.
- Reka portals render into `document.body`. Mount dialog and menu tests with
  `attachTo: document.body` and query `document.body`. A component that uses `Sidebar*` mounts
  inside `SidebarProvider`. A `matchMedia` stub that a test adds must return `matches`,
  `addEventListener` and `removeEventListener`.
- After a VeeValidate submit, wait with `await vi.waitFor(() => expect(...))`. The Zod parse is
  async, so `flushPromises()` alone is not enough.
- Give each test a fresh Pinia: `setActivePinia(createPinia())`, or pass `createPinia()` in
  `mount` plugins.

## Naming

Views `*View.vue`. Components PascalCase. Api modules and stores camelCase. Stores and composables
export a `use`-prefixed factory from a bare-domain filename.
