# Template Guide

This guide explains how to use this Vue 3 template as a starting point for your own project.

## Initial Setup

### 1. Clone or Fork

Clone the repository or fork it to your own GitHub account

### 2. Install Dependencies

```bash
corepack pnpm install
```

### 3. Configure Environment

Copy the example environment file and configure your API base URL:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_API_BASE_URL=http://your-api-url.com/api
```

### 4. Update Package Metadata

Edit `package.json` to rename the workspace package. The template ships as
`@fullstack/app` and declares a Node 24 floor:

```json
{
  "name": "@fullstack/app",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  }
}
```

The scripts you inherit — run them from `apps/app/`:

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `vite` | dev server on port 8080 |
| `build` | `vite build` | |
| `preview` | `vite preview` | serves the built `dist/` |
| `test` | `vitest run` | single run |
| `test:watch` | `vitest` | watch mode |
| `lint` | `run-s lint:*` | oxlint, then eslint, via `npm-run-all2` |
| `lint:oxlint` | `oxlint . --fix` | |
| `lint:eslint` | `eslint . --fix --cache` | |
| `format` | `prettier --write --experimental-cli src/` | **scoped to `src/`** — markdown in this folder is not Prettier-managed |

From the repo root, `corepack pnpm dev:app`, `build:app`, `lint:app`,
`test:app`, and `format:app` proxy to these through Turborepo. Dependency
versions are deliberately not reproduced here — read `package.json`, which is
the only copy that cannot drift.

## Customization Checklist

### Before You Start

- [ ] Update the `package.json` name
- [ ] Configure `VITE_API_BASE_URL` in `.env` — there is **no code-level default**, so a missing value makes every request URL start with the literal string `undefined`
- [ ] Update `<title>` in `index.html` (it ships as `Vite App`)
- [ ] Review and update authentication requirements

### Authentication

The template includes JWT-based authentication. To customize:

**Keep the auth system** - Update API endpoints in:

- `src/api/auth.js` - Modify endpoint paths
- `src/utils/http.js` - Update fetch client options if needed

**Remove auth entirely** - See [Removing Todo Features](#removing-todo-features) below for the same file-by-file pattern

### Routing

Routes are defined in `src/router/index.js`. Almost every route in this template
is tenant-scoped, so a new feature route normally hangs off an org and a project:

```javascript
{
  path: "/orgs/:orgId/projects/:projectId/your-path",
  name: "YourRouteName",
  component: () => import("@/views/your-folder/YourView.vue"),
  meta: { requiresAuth: true, permission: "your_resource:read" },
}
```

Three things to know before copying this:

- **Route params are camelCase (`:orgId`, `:projectId`) in the SPA, while the
  API path segments are snake_case (`:org_id`, `:project_id`).** The two
  namespaces are separate; do not "fix" one to match the other.
- **`meta.permission` is declarative only.** The router does not enforce it —
  it records intent for a future guard. Access control is enforced server-side
  by the API's `PermissionsGuard`, and the SPA hides actions via
  `usePermissions().can()`.
- **`SideNav.vue` does not read `meta.permission`.** It keeps its own
  `permission` field on each nav entry — a hand-maintained mirror of the route
  table. If you add a navigable route, add the matching entry there too, or it
  will never appear in the sidebar.

`meta: { requiresGuest: true }` is the opposite flag, for login/signup pages. A
route carrying **neither** flag is public in any session state.

## Adding New Features

Follow the layered architecture pattern when adding features:

### Step 1: API Layer (`src/api/`)

Create a new API service file. This layer only handles HTTP requests:

```javascript
// src/api/posts.js
import { request } from "@/utils/http"

function basePath(orgId, projectId) {
  return `/orgs/${orgId}/projects/${projectId}/posts`
}

export function getPosts(orgId, projectId, params = {}) {
  return request.get(basePath(orgId, projectId), params)
}

export function getPostById(orgId, projectId, postId) {
  return request.get(`${basePath(orgId, projectId)}/${postId}`)
}

export function createPost(orgId, projectId, data) {
  return request.post(basePath(orgId, projectId), data)
}

export function updatePost(orgId, projectId, postId, data) {
  return request.put(`${basePath(orgId, projectId)}/${postId}`, data)
}

export function deletePost(orgId, projectId, postId) {
  return request.del(`${basePath(orgId, projectId)}/${postId}`)
}
```

Two details that are easy to get wrong:

- **`request.get(url, params)` takes the params object directly** — the client
  is `src/utils/http.js`, not Axios, and its signatures are `get(url, params)`,
  `post(url, body)`, `put(url, body)`, `del(url, params)`. Nesting the object one
  level deeper, the way Axios config expects, is silently accepted and then
  serialises nothing — the request goes out unfiltered and unpaginated.
- **Query and body keys are snake_case**, matching the API contract verbatim —
  `page`, `limit`, `sort_by`, `sort_order`, `search`. The client performs no
  case conversion in either direction.

`src/api/todos.js` is the shipped file this example mirrors; diff against it if
something does not line up.

### Step 2: Store Layer (`src/stores/`)

Create a Pinia store using the Composition API setup syntax:

```javascript
// src/stores/posts.js
import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getPosts as apiGetPosts,
  getPostById as apiGetPostById,
  createPost as apiCreatePost,
  updatePost as apiUpdatePost,
  deletePost as apiDeletePost,
} from "@/api/posts"

export const usePostsStore = defineStore("posts", () => {
  // Multi-tenant context — set via setContext() before any API call
  const orgId = ref(null)
  const projectId = ref(null)

  // State
  const posts = ref([])
  const currentPost = ref(null)
  const pagination = ref(null)
  const loading = ref(false)

  function setContext(org, project) {
    orgId.value = org
    projectId.value = project
  }

  // Actions
  async function fetchPosts(params = {}) {
    loading.value = true
    try {
      const response = await apiGetPosts(orgId.value, projectId.value, params)
      posts.value = response.data.data
      pagination.value = response.data.pagination
      return response.data
    } catch (error) {
      posts.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchPostById(postId) {
    loading.value = true
    try {
      const response = await apiGetPostById(orgId.value, projectId.value, postId)
      currentPost.value = response.data.data
      return response.data
    } catch (error) {
      currentPost.value = null
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createPost(data) {
    loading.value = true
    try {
      const response = await apiCreatePost(orgId.value, projectId.value, data)
      message.success("Post created successfully!")
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function updatePost(postId, data) {
    loading.value = true
    try {
      const response = await apiUpdatePost(orgId.value, projectId.value, postId, data)
      message.success("Post updated successfully!")
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function deletePost(postId) {
    loading.value = true
    try {
      const response = await apiDeletePost(orgId.value, projectId.value, postId)
      message.success("Post deleted successfully!")
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    orgId,
    projectId,
    posts,
    currentPost,
    pagination,
    loading,
    // Actions
    setContext,
    fetchPosts,
    fetchPostById,
    createPost,
    updatePost,
    deletePost,
  }
})
```

**Unwrap depth.** `send()` returns an axios-shaped `{ data, status }` and the
server envelope is `{ message, data, pagination? }`, so the payload always sits
at `response.data.data` — for both the list and the single record. There is no
`.posts` or `.post` key below it. Paginated lists read `response.data.pagination`
alongside it.

### Step 3: Composable Layer (`src/composables/`)

Create a composable for UI logic and form handling:

```javascript
// src/composables/usePosts.js
import { ref, computed } from "vue"
import { usePostsStore } from "@/stores/posts"

export function usePosts() {
  const postsStore = usePostsStore()

  // Modal state
  const isModalVisible = ref(false)
  const editingPost = ref(null)

  // Validation rules
  const titleRules = [
    { required: true, message: "Please enter a title" },
    { max: 255, message: "Title cannot exceed 255 characters" },
  ]

  const contentRules = [{ required: true, message: "Please enter content" }]

  // Computed
  const isEditing = computed(() => !!editingPost.value)

  // Actions
  function openCreateModal() {
    editingPost.value = null
    isModalVisible.value = true
  }

  function openEditModal(post) {
    editingPost.value = { ...post }
    isModalVisible.value = true
  }

  function closeModal() {
    isModalVisible.value = false
    editingPost.value = null
  }

  async function handleSubmit(formData) {
    if (isEditing.value) {
      await postsStore.updatePost(editingPost.value.id, formData)
    } else {
      await postsStore.createPost(formData)
    }
    closeModal()
  }

  return {
    // Store state, re-exposed read-only
    posts: computed(() => postsStore.posts),
    pagination: computed(() => postsStore.pagination),
    loading: computed(() => postsStore.loading),
    currentPost: computed(() => postsStore.currentPost),
    // Modal state
    isModalVisible,
    editingPost,
    isEditing,
    // Validation rules
    titleRules,
    contentRules,
    // Pure store actions — delegated by reference
    setContext: postsStore.setContext,
    fetchPosts: postsStore.fetchPosts,
    fetchPostById: postsStore.fetchPostById,
    deletePost: postsStore.deletePost,
    // Wrappers that add modal state
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
  }
}
```

Note the split every composable in this template follows: state is re-exposed
as `computed()` so the view cannot write it, pure store actions are **delegated
by reference**, and only the wrappers that add modal state or a confirmation
step are defined in the composable itself.

### Step 4: View Layer (`src/views/`)

Create a view component that uses the composable:

```vue
<!-- src/views/posts/PostsListView.vue -->
<script setup>
import { onMounted } from "vue"
import { useRoute } from "vue-router"
import { usePosts } from "@/composables/usePosts"
import { usePermissions } from "@/composables/usePermissions"

const route = useRoute()

// Route params are camelCase in the SPA — see the Routing section above.
const orgId = route.params.orgId
const projectId = route.params.projectId

const {
  posts,
  loading,
  isModalVisible,
  editingPost,
  isEditing,
  titleRules,
  contentRules,
  setContext,
  fetchPosts,
  deletePost,
  openCreateModal,
  openEditModal,
  closeModal,
  handleSubmit,
} = usePosts()

const { can, loadPermissions } = usePermissions()

onMounted(() => {
  // setContext must run before the first request, or the store sends
  // `/orgs/null/projects/null/posts`.
  setContext(orgId, projectId)
  fetchPosts()
  loadPermissions(orgId)
})
</script>

<template>
  <div class="posts-list">
    <a-page-header title="Posts" />
    <a-button v-if="can('posts:create')" type="primary" @click="openCreateModal">
      Create Post
    </a-button>

    <a-table :dataSource="posts" :loading="loading" rowKey="id">
      <a-column title="Title" dataIndex="title" key="title" />
      <a-column title="Actions" key="actions">
        <template #default="{ record }">
          <a-space>
            <a-button v-if="can('posts:update')" @click="openEditModal(record)">Edit</a-button>
            <a-button v-if="can('posts:delete')" danger @click="deletePost(record.id)">
              Delete
            </a-button>
          </a-space>
        </template>
      </a-column>
    </a-table>

    <a-modal
      v-model:open="isModalVisible"
      :title="isEditing ? 'Edit Post' : 'Create Post'"
      @cancel="closeModal"
    >
      <a-form :model="editingPost" @finish="handleSubmit">
        <a-form-item label="Title" name="title" :rules="titleRules">
          <a-input v-model:value="editingPost.title" />
        </a-form-item>
        <a-form-item label="Content" name="content" :rules="contentRules">
          <a-textarea v-model:value="editingPost.content" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
```

### Step 5: Add Route

Add your route in `src/router/index.js`:

```javascript
{
  path: "/orgs/:orgId/projects/:projectId/posts",
  name: "PostsList",
  component: () => import("@/views/posts/PostsListView.vue"),
  meta: { requiresAuth: true, permission: "posts:read" },
}
```

### Step 6: Add the Nav Entry

`SideNav.vue` builds its menu from its own `PROJECT_ITEMS` / `ORG_ITEMS`
arrays, **not** from `route.meta`, so a route alone is invisible. Add a
matching entry to the `PROJECT_ITEMS` array in `src/components/SideNav.vue`,
importing the icon from `@ant-design/icons-vue` alongside the existing ones:

```javascript
import { FileTextOutlined } from "@ant-design/icons-vue"

{ key: "PostsList", label: "Posts", icon: FileTextOutlined, permission: "posts:read" },
```

`key` is the route name — it is what `selectedKeys` matches on — and
`permission` is the hand-maintained mirror of `meta.permission` that
`can(item.permission)` filters the list with. If your feature has a detail
route with no nav item of its own, add `matches: ["PostsList", "PostDetail"]`
so the parent item stays highlighted while the detail view is open.

## Form Validation Pattern

Use Ant Design's form validation with composable-defined rules:

```javascript
// In composable
const rules = [
  { required: true, message: "Field is required" },
  { min: 3, message: "Must be at least 3 characters" },
  { max: 100, message: "Cannot exceed 100 characters" },
]

// Custom validator
const customRules = [
  {
    validator: async (_rule, value) => {
      if (value && value !== formState.confirmValue) {
        throw new Error("Values do not match")
      }
    },
  },
]
```

## Protected Routes

Use route meta to control access:

```javascript
// Requires authentication — unauthenticated visitors go to /login?redirect=…
meta: {
  requiresAuth: true
}

// Redirects authenticated users to /orgs (login/signup pages)
meta: {
  requiresGuest: true
}

// Declarative only — recorded for a future guard, NOT enforced by the router
meta: {
  requiresAuth: true, permission: "posts:read"
}
```

The navigation guard acts on `requiresAuth` and `requiresGuest` only. It never
reads `meta.permission`, so do not treat that field as protection: real
enforcement is server-side, and the UI hides what the user cannot do via
`usePermissions().can()`.

## Removing Todo Features

To start with a clean slate, remove these files:

### Delete Files

```bash
# Remove todo API
rm src/api/todos.js

# Remove todo store
rm src/stores/todos.js

# Remove todo composable
rm src/composables/useTodos.js

# Remove todo views
rm -rf src/views/todos/

# Remove todo components
rm src/components/TodoFormModal.vue
```

### Update Router

Edit `src/router/index.js` and remove the todo routes:

```javascript
// Remove these routes:
{
  path: "/orgs/:orgId/projects/:projectId",
  name: "TodosList",
  component: () => import("@/views/todos/TodosListView.vue"),
  meta: { requiresAuth: true, permission: "todos:read" },
},
{
  path: "/orgs/:orgId/projects/:projectId/todos/:id",
  name: "TodoDetail",
  component: () => import("@/views/todos/TodoDetailView.vue"),
  meta: { requiresAuth: true, permission: "todos:read" },
},
```

Note that `TodosList` is the **project landing route** — it owns
`/orgs/:orgId/projects/:projectId` with no extra segment. Deleting it without
putting something else at that path leaves the project switcher navigating
nowhere, so replace it with your own feature route rather than simply removing it.

### Update Navigation

Edit `src/components/SideNav.vue` and remove the `TodosList` entry from the
`PROJECT_ITEMS` array — the one keyed `"TodosList"`, carrying the `todos:read`
permission and the `matches: ["TodosList", "TodoDetail"]` list. `SideNav` does
not read `route.meta`, so deleting the routes alone leaves a dead menu item that
renders and then fails to resolve. Drop the now-unused `CheckSquareOutlined`
import at the top of the file too, or the lint step will fail.

`src/components/AppShell.vue` is the layout shell (sider, top bar, breadcrumb)
and holds no per-feature menu entries — nothing to change there.

## Styling & Theming

### Ant Design Theme

There is **no Less pipeline** in this template — `vite.config.js` has no
`css.preprocessorOptions` block, so any Ant Design v4 recipe that overrides Less
variables at build time will do nothing here. This is Ant Design Vue v5-era
theming: a plain token object passed to `ConfigProvider`.

Tokens live in `src/theme/antd.js`:

```javascript
// src/theme/antd.js
export const antdTheme = {
  token: {
    colorPrimary: "#0e7c72", // --teal-500
    colorSuccess: "#2f855a", // --green-500
    colorError: "#c14444", // --red-500
    colorTextBase: "#171b20", // --gray-900
    colorBgBase: "#ffffff", // --gray-0
    fontFamily: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
    wireframe: false,
  },
  components: {
    Menu: {
      colorItemBgSelected: "#eef7f5", // --teal-50
      colorItemTextSelected: "#084f49", // --teal-700
    },
  },
}

export default antdTheme
```

and are applied once, at the root, in `src/App.vue`:

```vue
<script setup>
import { ConfigProvider } from "ant-design-vue"
import antdTheme from "@/theme/antd"
</script>

<template>
  <ConfigProvider :theme="antdTheme">
    <!-- ... -->
  </ConfigProvider>
</template>
```

To rebrand, edit the token values in `src/theme/antd.js` — no build
configuration changes and no restart-only Less variables.

Two gotchas worth knowing before you add tokens:

- **Component token names follow an older antd v5 schema** than the current Ant
  Design React docs describe, and unknown keys are dropped **silently**. Read
  the real name from `node_modules/ant-design-vue/es/<component>/style/index.d.ts`.
- **`theme/antd.test.js` asserts the tokens still match the design system.** Each
  value is annotated with the CSS custom property it mirrors; change one and
  update the other.

### CSS Variables

Below the antd layer sits `src/assets/design-system/` — a byte-identical copy of
the design system's `tokens/`, `fonts/`, and `styles.css`. It is copied, not
authored here, and `.prettierignore` excludes it so re-syncs produce real diffs.
Use its custom properties (`var(--teal-500)`, `var(--gray-200)`) in your own
scoped styles rather than hard-coding hex values.

Import order in `src/main.js` is load-bearing: `ant-design-vue/dist/reset.css`,
then `@/assets/design-system/styles.css`, then `@/assets/app.css` — so app-level
overrides always win over both.

### Global Styles

Add global styles in your component files or create a global stylesheet:

```vue
<style>
/* Global styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
</style>
```

## Common Patterns Reference

### API Response Handling

```javascript
// In store actions
async function fetchData() {
  loading.value = true
  try {
    const response = await apiCall()
    // Access data at response.data.data — the envelope is { message, data,
    // pagination? } and send() wraps it as { data, status }. There is no
    // resource key below it.
    items.value = response.data.data
    pagination.value = response.data.pagination
    return response.data
  } catch (error) {
    // Non-401 errors are already handled by the HTTP client (toast notification)
    items.value = []
    throw error
  } finally {
    loading.value = false
  }
}
```

### Message Notifications

```javascript
import { message } from "ant-design-vue"

message.success("Operation successful!")
message.error("Something went wrong")
message.warning("Please check your input")
message.info("Here is some information")
```

### localStorage Helpers

```javascript
import { setUserData, getUserData, clearUserData } from "@/utils/storage"

// Save user data
setUserData({ id: 1, name: "John Doe", email: "john@example.com" })

// Retrieve user data
const user = getUserData()

// Clear user data (logout)
clearUserData()
```

Auth tokens are stored as httpOnly cookies (managed by the server) — no token management needed in localStorage.

## Testing

```bash
corepack pnpm test          # single run
corepack pnpm test:watch    # watch mode
```

Vitest runs in a jsdom environment with `@vue/test-utils` for mounting components. Configuration lives in `vitest.config.js`, which merges `vite.config.js` so the `@` alias has a single definition.

Tests live beside the code they cover and are picked up by the `src/**/*.test.js` glob — for example `src/stores/auth.test.js`, `src/composables/useAuth.test.js`, and `src/views/auth/SignupView.test.js`.

**Mocking convention**: mock exactly one application boundary — `@/utils/http`. Composables, stores, and API service modules run for real, so a wrong argument order anywhere in the view → composable → store → api chain fails the test. Mocking `@/api/*` or `@/stores/*` defeats this. `vue-router` and Ant Design Vue's `message` are stubbed only as environment shims; `@/utils/storage` is left real because jsdom provides `localStorage`.

```javascript
vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
```

Store and composable tests call `setActivePinia(createPinia())` in `beforeEach`; component tests pass a fresh pinia via `mount(Component, { global: { plugins: [createPinia()] } })`.

## Next Steps

1. Remove todo features if not needed
2. Set up your backend API or use a mock service
3. Add your first feature following the layered architecture
4. Customize the UI theme to match your brand
5. Extend the test suite to cover your own stores and views

## Need Help?

- Check [AGENTS.md](AGENTS.md) for architecture details — the route table, store/composable/component catalogs, and the full HTTP client contract
- Check [README.md](README.md) for install, configuration, and run instructions
- Review existing code (auth, todos) for implementation patterns
- Refer to [Vue 3 docs](https://vuejs.org/)
- Refer to [Ant Design Vue docs](https://antdv.com/)
