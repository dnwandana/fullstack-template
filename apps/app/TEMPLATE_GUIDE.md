# Template Guide

This guide explains how to use this Vue 3 template as a starting point for your own project.

## Initial Setup

### 1. Clone or Fork

Clone the repository or fork it to your own GitHub account

### 2. Install Dependencies

```bash
npm install
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

Edit `package.json` to update your project information:

```json
{
  "name": "your-project-name",
  "description": "Your project description",
  ...
}
```

## Customization Checklist

### Before You Start

- [ ] Update `package.json` name and description
- [ ] Configure `VITE_API_BASE_URL` in `.env`
- [ ] Update `<title>` in `index.html`
- [ ] Review and update authentication requirements

### Authentication

The template includes JWT-based authentication. To customize:

**Keep the auth system** - Update API endpoints in:

- `src/api/auth.js` - Modify endpoint paths
- `src/utils/http.js` - Update fetch client options if needed

**Remove auth entirely** - See "Removing Features" section below

### Routing

Routes are defined in `src/router/index.js`. To add new routes:

```javascript
{
  path: '/your-path',
  name: 'YourRouteName',
  component: () => import('@/views/your-folder/YourView.vue'),
  meta: { requiresAuth: true },  // or requiresGuest: true
}
```

## Adding New Features

Follow the layered architecture pattern when adding features:

### Step 1: API Layer (`src/api/`)

Create a new API service file. This layer only handles HTTP requests:

```javascript
// src/api/posts.js
import { request } from '@/utils/http'

export function getPosts(params = {}) {
  return request.get('/posts', { params })
}

export function getPostById(id) {
  return request.get(`/posts/${id}`)
}

export function createPost(data) {
  return request.post('/posts', data)
}

export function updatePost(id, data) {
  return request.put(`/posts/${id}`, data)
}

export function deletePost(id) {
  return request.del(`/posts/${id}`)
}
```

### Step 2: Store Layer (`src/stores/`)

Create a Pinia store using the Composition API setup syntax:

```javascript
// src/stores/posts.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  getPosts as apiGetPosts,
  getPostById as apiGetPostById,
  createPost as apiCreatePost,
  updatePost as apiUpdatePost,
  deletePost as apiDeletePost,
} from '@/api/posts'

export const usePostsStore = defineStore('posts', () => {
  // State
  const posts = ref([])
  const currentPost = ref(null)
  const loading = ref(false)

  // Actions
  async function fetchPosts(params = {}) {
    loading.value = true
    try {
      const response = await apiGetPosts(params)
      posts.value = response.data.data.posts
      return response.data
    } catch (error) {
      posts.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  async function fetchPostById(id) {
    loading.value = true
    try {
      const response = await apiGetPostById(id)
      currentPost.value = response.data.data.post
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
      const response = await apiCreatePost(data)
      message.success('Post created successfully!')
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function updatePost(id, data) {
    loading.value = true
    try {
      const response = await apiUpdatePost(id, data)
      message.success('Post updated successfully!')
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  async function deletePost(id) {
    loading.value = true
    try {
      const response = await apiDeletePost(id)
      message.success('Post deleted successfully!')
      await fetchPosts()
      return response.data
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    posts,
    currentPost,
    loading,
    // Actions
    fetchPosts,
    fetchPostById,
    createPost,
    updatePost,
    deletePost,
  }
})
```

### Step 3: Composable Layer (`src/composables/`)

Create a composable for UI logic and form handling:

```javascript
// src/composables/usePosts.js
import { ref, computed } from 'vue'
import { usePostsStore } from '@/stores/posts'

export function usePosts() {
  const postsStore = usePostsStore()

  // Modal state
  const isModalVisible = ref(false)
  const editingPost = ref(null)

  // Validation rules
  const titleRules = [
    { required: true, message: 'Please enter a title' },
    { max: 255, message: 'Title cannot exceed 255 characters' },
  ]

  const contentRules = [{ required: true, message: 'Please enter content' }]

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
    // Store state
    posts: computed(() => postsStore.posts),
    loading: computed(() => postsStore.loading),
    currentPost: computed(() => postsStore.currentPost),
    // Modal state
    isModalVisible,
    editingPost,
    isEditing,
    // Validation rules
    titleRules,
    contentRules,
    // Actions
    fetchPosts: postsStore.fetchPosts,
    fetchPostById: postsStore.fetchPostById,
    deletePost: postsStore.deletePost,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
  }
}
```

### Step 4: View Layer (`src/views/`)

Create a view component that uses the composable:

```vue
<!-- src/views/posts/PostsListView.vue -->
<script setup>
import { onMounted } from 'vue'
import { usePosts } from '@/composables/usePosts'

const {
  posts,
  loading,
  isModalVisible,
  editingPost,
  isEditing,
  titleRules,
  contentRules,
  fetchPosts,
  deletePost,
  openCreateModal,
  openEditModal,
  closeModal,
  handleSubmit,
} = usePosts()

onMounted(() => {
  fetchPosts()
})
</script>

<template>
  <div class="posts-list">
    <a-page-header title="Posts" />
    <a-button type="primary" @click="openCreateModal"> Create Post </a-button>

    <a-table :dataSource="posts" :loading="loading" rowKey="id">
      <a-column title="Title" dataIndex="title" key="title" />
      <a-column title="Actions" key="actions">
        <template #default="{ record }">
          <a-space>
            <a-button @click="openEditModal(record)">Edit</a-button>
            <a-button danger @click="deletePost(record.id)">Delete</a-button>
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
  path: '/posts',
  name: 'PostsList',
  component: () => import('@/views/posts/PostsListView.vue'),
  meta: { requiresAuth: true },
}
```

## Form Validation Pattern

Use Ant Design's form validation with composable-defined rules:

```javascript
// In composable
const rules = [
  { required: true, message: 'Field is required' },
  { min: 3, message: 'Must be at least 3 characters' },
  { max: 100, message: 'Cannot exceed 100 characters' },
]

// Custom validator
const customRules = [
  {
    validator: async (_rule, value) => {
      if (value && value !== formState.confirmValue) {
        throw new Error('Values do not match')
      }
    },
  },
]
```

## Protected Routes

Use route meta to control access:

```javascript
// Requires authentication
meta: {
  requiresAuth: true
}

// Redirects authenticated users (login/signup pages)
meta: {
  requiresGuest: true
}
```

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
  path: '/todos',
  name: 'TodosList',
  component: () => import('@/views/todos/TodosListView.vue'),
  meta: { requiresAuth: true },
},
{
  path: '/todos/:id',
  name: 'TodoDetail',
  component: () => import('@/views/todos/TodoDetailView.vue'),
  meta: { requiresAuth: true },
},
```

### Update Layout

Edit `src/components/AppLayout.vue` and remove the Todos menu item.

## Styling & Theming

### Ant Design Theme

Customize Ant Design in `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // Add theme configuration
  ],
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          'primary-color': '#1890ff',
          'border-radius-base': '4px',
        },
        javascriptEnabled: true,
      },
    },
  },
}))
```

### Global Styles

Add global styles in your component files or create a global stylesheet:

```vue
<style>
/* Global styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    // Access data at response.data.data
    items.value = response.data.data.items
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
import { message } from 'ant-design-vue'

message.success('Operation successful!')
message.error('Something went wrong')
message.warning('Please check your input')
message.info('Here is some information')
```

### localStorage Helpers

```javascript
import { setUserData, getUserData, clearUserData } from '@/utils/storage'

// Save user data
setUserData({ id: 1, username: 'john' })

// Retrieve user data
const user = getUserData()

// Clear user data (logout)
clearUserData()
```

Auth tokens are stored as httpOnly cookies (managed by the server) — no token management needed in localStorage.

## Next Steps

1. Remove todo features if not needed
2. Set up your backend API or use a mock service
3. Add your first feature following the layered architecture
4. Customize the UI theme to match your brand
5. Add tests for critical functionality

## Need Help?

- Check [CLAUDE.md](CLAUDE.md) for architecture details
- Review existing code (auth, todos) for implementation patterns
- Refer to [Vue 3 docs](https://vuejs.org/)
- Refer to [Ant Design Vue docs](https://antdv.com/)
