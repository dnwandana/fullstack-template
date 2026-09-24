# AGENTS.md

Facts and invariants for `apps/app`. Commands, setup and the project tree are in
[`README.md`](README.md).

## Scope

Vue 3 + Vite + TypeScript SPA. Pinia setup stores, composables, Ant Design Vue, Vue Router, and a
custom fetch client in `src/utils/http.ts`. The dev server port 8080 must match the API's
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

- **Never pass a `#bodyCell` `record` to a typed handler.** It is `Record<string, any>`. Pass
  `record.id` and look the row up in `data-source`.
- `MembersTable` shows the Actions column only when `canRemove`, and the role dropdown only when
  `canUpdateRole`.
- `src/assets/design-system/` is a vendored copy. Prettier ignores it. Do not edit it here.
- `src/theme/antd.ts` mirrors the design-system tokens, and `theme/__tests__/antd.test.ts` pins
  them. `fontFamilyCode` stays behind `@ts-expect-error` on purpose.
- The CSS import order in `main.ts` is load-bearing: antd reset, then design system, then
  `app.css`.
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
- `src/` has no `any`, no `as` and no `!`. Two justified `@ts-expect-error` directives survive
  (`theme/antd.ts`, `InviteFormModal.vue`). Leave them.

## Testing

- Vitest, jsdom, `globals: true`. Tests live in `__tests__/` beside the code. Glob:
  `src/**/*.test.ts`.
- **Mock exactly one boundary: `@/utils/http`.** Composables, stores and api modules run for real.
  Also mock `vue-router` and the antd `message`. Leave `@/utils/storage` real.
- Build mocked responses with the factories in `src/test/fixtures.ts` (`makeX`, `ok`,
  `okPaginated`), never with object literals. `makeInvitationPreview` deliberately does not spread
  `makeInvitation`.
- Reach the mock through `vi.mocked(request.get)`, not a cast. A component test that mounts an antd
  grid must stub `window.matchMedia`.
- Give each test a fresh Pinia: `setActivePinia(createPinia())`, or pass `createPinia()` in
  `mount` plugins.

## Naming

Views `*View.vue`. Components PascalCase. Api modules and stores camelCase. Stores and composables
export a `use`-prefixed factory from a bare-domain filename.
