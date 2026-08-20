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
| `build` | `vue-tsc -b && vite build` | type check first — a type error fails the build |
| `typecheck` | `vue-tsc -b --force` | type check only; `--force` skips the incremental cache |
| `preview` | `vite preview` | serves the built `dist/` |
| `test` | `vitest run` | single run |
| `test:watch` | `vitest` | watch mode |
| `lint` | `run-s lint:*` | oxlint, then eslint, via `npm-run-all2` |
| `lint:oxlint` | `oxlint . --fix` | |
| `lint:eslint` | `eslint . --fix --cache` | |
| `format` | `prettier --write --experimental-cli src/` | **scoped to `src/`** — markdown in this folder is not Prettier-managed |

From the repo root, `corepack pnpm dev:app`, `build:app`, `lint:app`,
`typecheck:app`, `test:app`, and `format:app` proxy to these through Turborepo.
Dependency versions are deliberately not reproduced here — read `package.json`,
which is the only copy that cannot drift.

## Customization Checklist

### Before You Start

- [ ] Update the `package.json` name
- [ ] Configure `VITE_API_BASE_URL` in `.env` — there is **no code-level default**, so a missing value makes every request URL start with the literal string `undefined`
- [ ] Update `<title>` in `index.html` (it ships as `Vite App`)
- [ ] Review and update authentication requirements

### Authentication

The template includes JWT-based authentication. To customize:

**Keep the auth system** - Update API endpoints in:

- `src/api/auth.ts` - Modify endpoint paths
- `src/utils/http.ts` - Update fetch client options if needed

**Remove auth entirely** - See [Removing Todo Features](#removing-todo-features) below for the same file-by-file pattern

### Routing

Routes are defined in `src/router/index.ts`. Almost every route in this template
is tenant-scoped, so a new feature route normally hangs off an org and a project:

```ts
{
  path: "/orgs/:orgId/projects/:projectId/your-path",
  name: "YourRouteName",
  component: () => import("@/views/your-folder/YourView.vue"),
  meta: { requiresAuth: true, permission: "your_resource:read" },
}
```

Four things to know before copying this:

- **Route params are camelCase (`:orgId`, `:projectId`) in the SPA, while the
  API path segments are snake_case (`:org_id`, `:project_id`).** The two
  namespaces are separate; do not "fix" one to match the other.
- **`meta.permission` is declarative only.** The router does not enforce it —
  it records intent for a future guard. Access control is enforced server-side
  by the API's `PermissionsGuard`, and the SPA hides actions via
  `usePermissions().can()`.
- **`meta` is a typed object.** `src/router/index.ts` opens a
  `declare module "vue-router"` block augmenting vue-router's `RouteMeta` with
  `requiresAuth?: boolean`, `requiresGuest?: boolean` and `permission?: string`.
  A typo such as `requresAuth` is a compile error rather than a flag that
  silently never fires, and adding a **new** meta key means extending that
  interface first.
- **`SideNav.vue` does not read `meta.permission`.** It keeps its own
  `permission` field on each nav entry — a hand-maintained mirror of the route
  table. If you add a navigable route, add the matching entry there too, or it
  will never appear in the sidebar.

`meta: { requiresGuest: true }` is the opposite flag, for login/signup pages. A
route carrying **neither** flag is public in any session state.

## TypeScript

The whole app is TypeScript under `strict: true`. There is no JavaScript escape
hatch left, which matters because the failure modes are quiet:

- **`allowJs` is off.** `tsconfig.app.json` includes `env.d.ts`, `src/**/*.ts`
  and `src/**/*.vue` — no `.js` glob — so a `.js` file you add under `src/` is
  not compiled, not type-checked, and not part of the build graph. The only
  `.js` in the package is `eslint.config.js`, outside `src/` on purpose.
- **A `lang`-less SFC is a lint error.** `vueTsConfigs.recommended` turns on
  `vue/block-lang`, and `eslint.config.js` narrows the accepted set to TypeScript
  with `configureVueProject({ scriptLangs: ["ts"] })` — so a plain
  `<script setup>` fails `lint`. Every SFC opens with `<script setup lang="ts">`.
- **Tests are `.test.ts`.** `vitest.config.ts` includes `src/**/*.test.ts`,
  `tsconfig.app.json` excludes that same glob (`tsconfig.vitest.json` picks it
  up instead), and the `app/test-files` ESLint block registers the Vitest globals
  for `**/*.test.ts`. A `.test.js` file matches none of the three and is silently
  never run.
- **Entity types come from `@fullstack/contracts`**, a workspace dependency
  (`workspace:*`) that `apps/api` also consumes. See
  [Step 1](#step-1-api-layer-srcapi) for how to add your own.

Run `corepack pnpm typecheck` (or `typecheck:app` from the repo root) as often as
you run the tests — `build` runs `vue-tsc -b` first, so anything the checker
rejects fails the build too.

## Adding New Features

Follow the layered architecture pattern when adding features:

### Step 1: API Layer (`src/api/`)

First declare the entity in `packages/contracts` — that package is the single
source of truth for API shapes, and the API binds its response classes to it
with `implements`, so a field renamed on one side becomes a compile error on the
other. Add `packages/contracts/src/post.ts`:

```ts
// packages/contracts/src/post.ts
export type Post = {
  id: string
  project_id: string
  title: string
  content: string | null
  created_at: Date
  updated_at: Date
}
```

and re-export it from the package's one barrel, `packages/contracts/src/index.ts`:

```ts
export type { Post } from "./post"
```

Declare timestamps as `Date` — that is the API's in-memory shape. The frontend
never consumes `Post` directly; it consumes `Wire<Post>`, a recursive mapped type
that rewrites every `Date` to `string`, which is what actually arrives over the
wire. The package is **type-only and dependency-free**, so every import of it
must be `import type`.

Now create the API service file. This layer only handles HTTP requests:

```ts
// src/api/posts.ts
import type { Envelope, PaginatedEnvelope, Post, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * Query params the list endpoint accepts. Declared as `type`, not `interface`, so it
 * satisfies the index signature `QueryParams` requires — TypeScript grants an implicit
 * index signature to object type aliases but not to interface declarations.
 */
export type PostListParams = {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: string
  search?: string
}

/** The body `createPost` and `updatePost` send. */
export type PostInput = {
  title: string
  content?: string
}

function basePath(orgId: string, projectId: string): string {
  return `/orgs/${orgId}/projects/${projectId}/posts`
}

export function getPosts(
  orgId: string,
  projectId: string,
  params: PostListParams = {},
): Promise<HttpResult<PaginatedEnvelope<Wire<Post>[]>>> {
  return request.get<PaginatedEnvelope<Wire<Post>[]>>(basePath(orgId, projectId), params)
}

export function getPostById(
  orgId: string,
  projectId: string,
  postId: string,
): Promise<HttpResult<Envelope<Wire<Post>>>> {
  return request.get<Envelope<Wire<Post>>>(`${basePath(orgId, projectId)}/${postId}`)
}

export function createPost(
  orgId: string,
  projectId: string,
  data: PostInput,
): Promise<HttpResult<Envelope<Wire<Post>>>> {
  return request.post<Envelope<Wire<Post>>>(basePath(orgId, projectId), data)
}

export function updatePost(
  orgId: string,
  projectId: string,
  postId: string,
  data: PostInput,
): Promise<HttpResult<Envelope<Wire<Post>>>> {
  return request.put<Envelope<Wire<Post>>>(`${basePath(orgId, projectId)}/${postId}`, data)
}

export function deletePost(
  orgId: string,
  projectId: string,
  postId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`${basePath(orgId, projectId)}/${postId}`)
}
```

Details that are easy to get wrong:

- **`request.get(url, params)` takes the params object directly** — the client
  is `src/utils/http.ts`, not Axios, and its signatures are `get(url, params)`,
  `post(url, body)`, `put(url, body)`, `del(url, params)`. Nesting the object one
  level deeper, the way Axios config expects, no longer type-checks: `params` is
  `QueryParams`, i.e. `Record<string, string | number | boolean | undefined>`.
  For the same reason `Record<string, unknown>` is **not** a usable param type —
  declare a named `type` with the exact keys, as `PostListParams` does above.
- **The type argument is the whole envelope, not the payload.** `request.get<E>`
  resolves to `HttpResult<E>`, which is `{ data: E; status: number }`, and the
  server envelope is `{ message, data, pagination? }`. So `E` is
  `Envelope<Wire<Post>>` — writing `Wire<Post>` there compiles and then makes
  `response.data.data` an error at every call site. List endpoints use
  `PaginatedEnvelope<Wire<Post>[]>`, whose `pagination` is non-optional; note the
  `[]` sits **inside** the envelope, on the payload.
- **`Wire<Post>`, never `Post`.** `created_at` and `updated_at` are `Date` in the
  contract and `string` in the browser. A fixture or mock you hand-write must use
  strings too.
- **Return types are written out.** `request.get<E>` already infers them, so the
  annotation is a restatement — every shipped module in `src/api/` carries it
  anyway, because it documents the module's surface without opening the body.
  Match the house style rather than mixing.
- **Query and body keys are snake_case**, matching the API contract verbatim —
  `page`, `limit`, `sort_by`, `sort_order`, `search`. The client performs no
  case conversion in either direction.
- **Paths here are bare — no `/api`, no `/v1`.** Both segments live in
  `baseURL` in `src/utils/http.ts`, which is `` `${VITE_API_BASE_URL}/v1` ``.
  Writing the version at a call site produces a doubled `/v1` *and* silently
  stops matching `NO_RETRY_ENDPOINTS` / `NO_REDIRECT_ENDPOINTS`, which compare
  the bare `url` with `.includes()`.

`src/api/todos.ts` is the shipped file this example mirrors; diff against it if
something does not line up.

### Step 2: Store Layer (`src/stores/`)

Create a Pinia store using the Composition API setup syntax:

```ts
// src/stores/posts.ts
import type { Envelope, PaginatedEnvelope, PaginationMeta, Post, Wire } from "@fullstack/contracts"
import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getPosts as apiGetPosts,
  getPostById as apiGetPostById,
  createPost as apiCreatePost,
  updatePost as apiUpdatePost,
  deletePost as apiDeletePost,
  type PostInput,
  type PostListParams,
} from "@/api/posts"

export const usePostsStore = defineStore("posts", () => {
  // Multi-tenant context — set via setContext() before any API call
  const orgId = ref<string | null>(null)
  const projectId = ref<string | null>(null)

  // State
  const posts = ref<Wire<Post>[]>([])
  const currentPost = ref<Wire<Post> | null>(null)
  const pagination = ref<PaginationMeta | null>(null)
  const loading = ref(false)

  function setContext(org: string, project: string): void {
    orgId.value = org
    projectId.value = project
  }

  /**
   * Read the tenant context for an API call. The refs are `string | null` and every function
   * in `api/posts` takes `string`, so passing `orgId.value` straight through is a compile
   * error. `String()` reproduces the untyped behaviour exactly — a literal `/orgs/null/...`
   * URL when the context was never set — rather than inventing a new failure mode.
   */
  function ctx(): { org: string; project: string } {
    return { org: String(orgId.value), project: String(projectId.value) }
  }

  // Actions
  async function fetchPosts(params: PostListParams = {}): Promise<PaginatedEnvelope<Wire<Post>[]>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiGetPosts(org, project, params)
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

  async function fetchPostById(postId: string): Promise<Envelope<Wire<Post>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiGetPostById(org, project, postId)
      currentPost.value = response.data.data
      return response.data
    } catch (error) {
      currentPost.value = null
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createPost(data: PostInput): Promise<Envelope<Wire<Post>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiCreatePost(org, project, data)
      message.success("Post created successfully!")
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function updatePost(postId: string, data: PostInput): Promise<Envelope<Wire<Post>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiUpdatePost(org, project, postId, data)
      message.success("Post updated successfully!")
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function deletePost(postId: string): Promise<Envelope<null>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiDeletePost(org, project, postId)
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

**Annotate only the refs that need it.** A `ref` whose initialiser is `null` or
`[]` infers `Ref<null>` / `Ref<never[]>`, which is useless — those need the type
argument. Everything else is fine on its own: `loading` stays `ref(false)`,
because `Ref<boolean>` is exactly what infers. The reflex to annotate everything
costs you a second declaration to keep in step for no checking in return.

**`pagination` is nullable here, but not in `stores/todos.ts`.** The shipped
store seeds a full `PaginationMeta` default instead, because `TodosListView`
binds `pagination.current_page` straight into the AntD `Table` with no guard.
Pick nullable if nothing reads the fields before the first fetch; pick a seeded
default if a template does.

**Unwrap depth.** `send()` returns an axios-shaped `{ data, status }` and the
server envelope is `{ message, data, pagination? }`, so the payload always sits
at `response.data.data` — for both the list and the single record. There is no
`.posts` or `.post` key below it. Paginated lists read `response.data.pagination`
alongside it. This is where the "the type argument is the whole envelope" rule
from Step 1 pays off: get `E` wrong and every one of these lines is an error.

### Step 3: Composable Layer (`src/composables/`)

Create a composable for UI logic and form handling:

```ts
// src/composables/usePosts.ts
import { ref, computed } from "vue"
import type { Rule } from "ant-design-vue/es/form"
import type { Post, Wire } from "@fullstack/contracts"
import type { PostInput } from "@/api/posts"
import { usePostsStore } from "@/stores/posts"

export function usePosts() {
  const postsStore = usePostsStore()

  // Modal state
  const isModalVisible = ref(false)
  const editingPost = ref<Wire<Post> | null>(null)

  // Validation rules
  const titleRules: Rule[] = [
    { required: true, message: "Please enter a title" },
    { max: 255, message: "Title cannot exceed 255 characters" },
  ]

  const contentRules: Rule[] = [{ required: true, message: "Please enter content" }]

  // Computed
  const isEditing = computed(() => !!editingPost.value)

  // Actions
  function openCreateModal(): void {
    editingPost.value = null
    isModalVisible.value = true
  }

  function openEditModal(post: Wire<Post>): void {
    editingPost.value = { ...post }
    isModalVisible.value = true
  }

  function closeModal(): void {
    isModalVisible.value = false
    editingPost.value = null
  }

  async function handleSubmit(formData: PostInput): Promise<void> {
    // Read the ref into a local first: control-flow analysis cannot narrow
    // `editingPost.value` through the `isEditing` computed, so `editingPost.value.id`
    // inside `if (isEditing.value)` is a "possibly null" error. The local is
    // behaviour-identical — `isEditing` is exactly `!!editingPost.value`, and nothing
    // awaits between the two reads.
    const editing = editingPost.value
    if (editing) {
      await postsStore.updatePost(editing.id, formData)
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

Two typing rules for this layer:

- **Parameters are annotated, the return object is not.** Handlers get `: void`
  or `: Promise<void>`. Do **not** write an interface for the returned object —
  it is a second declaration of something the compiler already knows exactly,
  and it drifts the first time someone adds a field.
- **`Rule[]`, imported from `ant-design-vue/es/form`,** is how validation rules
  are typed. Annotating them is what makes a misspelled rule key (`requred`) an
  error instead of a rule that silently never applies.

### Step 4: View Layer (`src/views/`)

Create a view component that uses the composable:

```vue
<!-- src/views/posts/PostsListView.vue -->
<script setup lang="ts">
import { onMounted } from "vue"
import { useRoute } from "vue-router"
import { Table, Button, Space, Popconfirm, Typography } from "ant-design-vue"
import type { ColumnsType } from "ant-design-vue/es/table"
import type { Post, Wire } from "@fullstack/contracts"
import { usePosts } from "@/composables/usePosts"
import { usePermissions } from "@/composables/usePermissions"
import PostFormModal from "@/components/PostFormModal.vue"

const route = useRoute()

// Route params are camelCase in the SPA — see the Routing section above.
const orgId = String(route.params.orgId)
const projectId = String(route.params.projectId)

const {
  posts,
  loading,
  isModalVisible,
  editingPost,
  setContext,
  fetchPosts,
  deletePost,
  openCreateModal,
  openEditModal,
  closeModal,
  handleSubmit,
} = usePosts()

const { can, loadPermissions } = usePermissions()

const columns: ColumnsType<Wire<Post>> = [
  { title: "Title", dataIndex: "title", key: "title", ellipsis: true },
  { title: "Actions", key: "actions", width: 150, fixed: "right" },
]

// The `#bodyCell` slot hard-types `record` as `Record<string, any>`, so look the
// row up in `posts` — the table's own data-source — instead of passing `record` on.
function editPost(id: string): void {
  const post = posts.value.find((candidate) => candidate.id === id)
  if (post) {
    openEditModal(post)
  }
}

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
    <Typography.Title :level="4">Posts</Typography.Title>
    <Button v-if="can('posts:create')" type="primary" @click="openCreateModal">Create Post</Button>

    <Table :columns="columns" :data-source="posts" :loading="loading" :row-key="(r) => r.id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <Space>
            <Button v-if="can('posts:update')" size="small" @click="editPost(record.id)">
              Edit
            </Button>
            <Popconfirm
              v-if="can('posts:delete')"
              title="Delete this post?"
              @confirm="deletePost(record.id)"
            >
              <Button size="small" danger>Delete</Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>

    <PostFormModal
      :visible="isModalVisible"
      :post="editingPost"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>
```

Four conventions in that file, all of them applied to every shipped view:

- **`String(route.params.X)`.** vue-router types params as `string | string[]`
  because repeatable segments (`:id+`) yield arrays; this app declares none, so
  the array branch never runs. `String(...)` narrows without an assertion —
  `as string` is what a review grep looks for, and it lies about a case the
  compiler was right to raise. `paramToString` in `src/utils/route-params.ts`
  exists for the *other* case, where absence is real and `null` is a meaningful
  answer (the tenant store's `currentOrgId`); do not reach for it on an ordinary
  view param.
- **Components are imported, not resolved globally.** `main.ts` does install the
  whole Ant Design Vue plugin, but the views import what they use so `vue-tsc`
  checks the props.
- **`ColumnsType<Wire<Post>>` from `ant-design-vue/es/table`.** That is the Vue
  port's export name. `TableColumnsType` is antd React's and does not exist here
  — it is the single most likely wrong import a reader reaches for.
- **`#bodyCell` is not generic over the row type.** AntD declares the slot's
  `record` as `Record<string, any>`, so reading `record.id` is fine but handing
  `record` to a parameter typed `Wire<Post>` is not. Pass the id and look the row
  up in the data-source, as `editPost` does. `editTodo` in
  `src/views/todos/TodosListView.vue` and `editRole` in
  `src/views/orgs/OrgRolesView.vue` are the shipped instances of this.

The modal is its own component so the form never has to write through a possibly
null `editingPost`. It shows the two remaining component conventions —
`withDefaults(defineProps<Props>(), {...})` and the tuple-style `defineEmits`:

```vue
<!-- src/components/PostFormModal.vue -->
<script setup lang="ts">
import { reactive, watch } from "vue"
import { Form, Modal, Input } from "ant-design-vue"
import type { Rule } from "ant-design-vue/es/form"
import type { Post, Wire } from "@fullstack/contracts"
import type { PostInput } from "@/api/posts"

interface Props {
  visible?: boolean
  post?: Wire<Post> | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  post: null,
  loading: false,
})

const emit = defineEmits<{
  submit: [payload: PostInput]
  cancel: []
}>()

const formState = reactive({ title: "", content: "" })

const rules = reactive<Record<string, Rule[]>>({
  title: [
    { required: true, message: "Please enter a title" },
    { max: 255, message: "Title cannot exceed 255 characters" },
  ],
})

const { validate, resetFields } = Form.useForm(formState, rules)

watch(
  () => props.post,
  (newPost) => {
    if (newPost) {
      formState.title = newPost.title
      formState.content = newPost.content ?? ""
    } else {
      resetFields()
    }
  },
  { immediate: true },
)

async function handleOk(): Promise<void> {
  try {
    await validate()
    emit("submit", { title: formState.title, content: formState.content || undefined })
  } catch {
    // Validation failed; ant-design-vue renders the messages.
  }
}
</script>

<template>
  <Modal
    :open="visible"
    title="Post"
    :confirm-loading="loading"
    @ok="handleOk"
    @cancel="emit('cancel')"
  >
    <Form :model="formState" :rules="rules" layout="vertical">
      <Form.Item label="Title" name="title">
        <Input v-model:value="formState.title" />
      </Form.Item>
      <Form.Item label="Content" name="content">
        <Input.TextArea v-model:value="formState.content" />
      </Form.Item>
    </Form>
  </Modal>
</template>
```

An **array or object default must be a factory** — `withDefaults(..., { tags: () => [] })`,
never `{ tags: [] }` — the same rule Vue's runtime props have always had, now
enforced by the type. And note the emits form: `submit: [payload: PostInput]` is
a tuple of argument types, not a validator function. `src/components/TodoFormModal.vue`
is the shipped file this mirrors.

### Step 5: Add Route

Add your route in `src/router/index.ts`:

```ts
{
  path: "/orgs/:orgId/projects/:projectId/posts",
  name: "PostsList",
  component: () => import("@/views/posts/PostsListView.vue"),
  meta: { requiresAuth: true, permission: "posts:read" },
}
```

`requiresAuth` and `permission` type-check because `src/router/index.ts` augments
vue-router's `RouteMeta` — see the [Routing](#routing) section. A misspelled key
is rejected; a genuinely new key has to be added to that interface first.

### Step 6: Add the Nav Entry

`SideNav.vue` builds its menu from its own `PROJECT_ITEMS` / `ORG_ITEMS`
arrays, **not** from `route.meta`, so a route alone is invisible. Add a
matching entry to the `PROJECT_ITEMS` array in `src/components/SideNav.vue`,
importing the icon from `@ant-design/icons-vue` alongside the existing ones:

```ts
import { FileTextOutlined } from "@ant-design/icons-vue"

{ key: "PostsList", label: "Posts", icon: FileTextOutlined, permission: "posts:read" },
```

`key` is the route name — it is what `selectedKeys` matches on — and
`permission` is the hand-maintained mirror of `meta.permission` that
`can(item.permission)` filters the list with. If your feature has a detail
route with no nav item of its own, add `matches: ["PostsList", "PostDetail"]`
so the parent item stays highlighted while the detail view is open.

Both arrays are annotated `NavItem[]`, an interface declared in the same file:

```ts
interface NavItem {
  /** Route name — also what `selectedKeys` matches on. */
  key: string
  label: string
  icon: Component
  /** Mirrors the route's `meta.permission`. */
  permission: string
  /** Extra route names that should keep this item lit. Defaults to `[key]`. */
  matches?: string[]
}
```

(`Component` is imported from `vue`.) That annotation is the one concrete thing
typing bought this step: a forgotten `permission` or a misspelled `key` is now a
compile error rather than a nav item that renders and then fails to resolve. It
does **not** check that `key` names a real route or that `permission` matches the
route's — those two mirrors are still yours to keep in step.

## Form Validation Pattern

Use Ant Design's form validation with composable-defined rules:

```ts
import type { Rule } from "ant-design-vue/es/form"

// In composable
const rules: Rule[] = [
  { required: true, message: "Field is required" },
  { min: 3, message: "Must be at least 3 characters" },
  { max: 100, message: "Cannot exceed 100 characters" },
]

// Custom validator — `_rule` and `value` are contextually typed by `Rule`
const customRules: Rule[] = [
  {
    validator: async (_rule, value) => {
      if (value && value !== formState.confirmValue) {
        throw new Error("Values do not match")
      }
    },
  },
]
```

A component that hands rules to `Form.useForm` keys them by field name instead,
as `Record<string, Rule[]>` — see `src/components/TodoFormModal.vue`.

## Protected Routes

Use route meta to control access:

```ts
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
`usePermissions().can()`. All three keys are declared on the augmented
`RouteMeta` in `src/router/index.ts`; anything else is a type error.

## Removing Todo Features

To start with a clean slate, remove these files:

### Delete Files

```bash
# Remove todo API
rm src/api/todos.ts

# Remove todo store
rm src/stores/todos.ts

# Remove todo composable
rm src/composables/useTodos.ts

# Remove todo views
rm -rf src/views/todos/

# Remove todo components
rm src/components/TodoFormModal.vue
```

The entity type lives outside this package, in `packages/contracts/src/todo.ts`,
and `apps/api`'s `TodoResponse` / `TodoListResponse` bind to it with `implements`.
Leaving it in place costs nothing; removing it means deleting the contract file,
its `export type { Todo, TodoList } from "./todo"` line in
`packages/contracts/src/index.ts`, and the API's todos module in the same change,
or the workspace build breaks.

### Update Router

Edit `src/router/index.ts` and remove the todo routes:

```ts
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

There is **no Less pipeline** in this template — `vite.config.ts` has no
`css.preprocessorOptions` block, so any Ant Design v4 recipe that overrides Less
variables at build time will do nothing here. This is Ant Design Vue v5-era
theming: a plain token object passed to `ConfigProvider`.

Tokens live in `src/theme/antd.ts`:

```ts
// src/theme/antd.ts
import type { ThemeConfig } from "ant-design-vue/es/config-provider/context"

export const antdTheme: ThemeConfig = {
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
<script setup lang="ts">
import { ConfigProvider } from "ant-design-vue"
import antdTheme from "@/theme/antd"
</script>

<template>
  <ConfigProvider :theme="antdTheme">
    <!-- ... -->
  </ConfigProvider>
</template>
```

To rebrand, edit the token values in `src/theme/antd.ts` — no build
configuration changes and no restart-only Less variables.

Three gotchas worth knowing before you add tokens:

- **Component token names follow an older antd v5 schema** than the current Ant
  Design React docs describe, and unknown keys are dropped **silently**. Read
  the real name from `node_modules/ant-design-vue/es/<component>/style/index.d.ts`.
- **`ThemeConfig` catches only half of that.** A token the installed version does
  not declare is now a compile error rather than a silent no-op — but a token it
  *does* declare and no longer reads still passes. The shipped file carries one
  `@ts-expect-error` for exactly this case (`fontFamilyCode`); read the comment
  there before adding another.
- **`src/theme/__tests__/antd.test.ts` asserts the tokens still match the design
  system.** Each value is annotated with the CSS custom property it mirrors;
  change one and update the other. The test asserts the literal, so it stays
  green even for a token antd ignores.

### CSS Variables

Below the antd layer sits `src/assets/design-system/` — a byte-identical copy of
the design system's `tokens/`, `fonts/`, and `styles.css`. It is copied, not
authored here, and `.prettierignore` excludes it so re-syncs produce real diffs.
Use its custom properties (`var(--teal-500)`, `var(--gray-200)`) in your own
scoped styles rather than hard-coding hex values.

Import order in `src/main.ts` is load-bearing: `ant-design-vue/dist/reset.css`,
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

```ts
// In store actions
async function fetchData(): Promise<PaginatedEnvelope<Wire<Post>[]>> {
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

`error` in that `catch` is `unknown` under `strict` — narrow it before you read
anything off it (`error instanceof HttpError` gives you `.status` and
`.response.data`; `HttpError` is exported from `src/utils/http.ts`). Rethrowing
it untouched, as above, needs no narrowing.

### Message Notifications

```ts
import { message } from "ant-design-vue"

message.success("Operation successful!")
message.error("Something went wrong")
message.warning("Please check your input")
message.info("Here is some information")
```

### localStorage Helpers

```ts
import { setUserData, getUserData, clearUserData } from "@/utils/storage"

// Save user data — the payload is `StoredUser`, i.e. `Wire<User>`
setUserData({ id: "8c2f…", name: "John Doe", email: "john@example.com" })

// Retrieve user data — `StoredUser | null`, so narrow before use
const user = getUserData()

// Clear user data (logout)
clearUserData()
```

Auth tokens are stored as httpOnly cookies (managed by the server) — no token management needed in localStorage.

## Testing

```bash
corepack pnpm test          # single run
corepack pnpm test:watch    # watch mode
corepack pnpm typecheck     # vue-tsc only; `build` runs this first anyway
```

Vitest runs in a jsdom environment with `@vue/test-utils` for mounting components. Configuration lives in `vitest.config.ts`, which merges `vite.config.ts` so the `@` alias has a single definition.

Tests live beside the code they cover and are picked up by the `src/**/*.test.ts` glob — for example `src/stores/__tests__/auth.test.ts`, `src/composables/__tests__/useAuth.test.ts`, and `src/views/auth/__tests__/SignupView.test.ts`. They are excluded from `tsconfig.app.json` and type-checked by `tsconfig.vitest.json` instead, so a test file still has to compile — it just does not enter the app build.

**Mocking convention**: mock exactly one application boundary — `@/utils/http`. Composables, stores, and API service modules run for real, so a wrong argument order anywhere in the view → composable → store → api chain fails the test. Mocking `@/api/*` or `@/stores/*` defeats this. `vue-router` and Ant Design Vue's `message` are stubbed only as environment shims; `@/utils/storage` is left real because jsdom provides `localStorage`.

```ts
vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
```

Four things about typed tests:

- **`status` is mandatory on every mocked resolution.** `vi.mocked(request.get)`
  collapses the generic to `HttpResult<unknown>`, whose `status` is not optional,
  so `mockResolvedValue({ data: { data: [] } })` no longer compiles — write
  `mockResolvedValue({ data: { data: [] }, status: 200 })`.
- **Fixtures use wire shapes.** `created_at` and `updated_at` are strings, not
  `Date` objects, because that is what `Wire<T>` says arrives.
- **A `vi.mock` factory is hoisted above the file**, so any variable it closes
  over has to come from `vi.hoisted()` or it is still in its temporal dead zone
  when the factory runs. `src/stores/__tests__/roles.test.ts` shows the pattern.
- **Stub `window.matchMedia`** in any test that mounts an AntD grid or overlay —
  jsdom does not implement it, and antd's responsive observer subscribes on mount.
  `src/components/__tests__/OrgSwitcher.test.ts` has a copyable stub.

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
