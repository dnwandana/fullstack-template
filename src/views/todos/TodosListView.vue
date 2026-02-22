<script setup>
import { h, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  Select,
  Empty,
  Skeleton,
  Input,
  Breadcrumb,
} from "ant-design-vue"
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SettingOutlined,
} from "@ant-design/icons-vue"
import { useTodos } from "@/composables/useTodos"
import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import TodoFormModal from "@/components/TodoFormModal.vue"

const route = useRoute()
const router = useRouter()

// Extract multi-tenant identifiers from route params
const orgId = route.params.orgId
const projectId = route.params.projectId

const {
  todos,
  pagination,
  loading,
  selectedIds,
  hasSelected,
  selectedCount,
  sortBy,
  sortOrder,
  isModalVisible,
  editingTodo,
  fetchTodos,
  deleteTodo,
  bulkDelete,
  openCreateModal,
  openEditModal,
  closeModal,
  handleSubmit,
  handlePageChange,
  handleSortChange,
  handleSearch,
  handleSelectionChange,
  searchQuery,
  setContext,
} = useTodos()

const { fetchOrgById, currentOrg } = useOrgs()
const { fetchProjectById, currentProject } = useProjects()
const { can, canAny, loadPermissions } = usePermissions()
const authStore = useAuthStore()

// Table columns
const columns = [
  {
    title: "Title",
    dataIndex: "title",
    key: "title",
    ellipsis: true,
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    // Show dash when description is empty
    customRender: ({ text }) => {
      if (text) return text
      return "-"
    },
  },
  {
    title: "Status",
    dataIndex: "is_completed",
    key: "is_completed",
    width: 120,
    // Render a colored tag based on completion status
    customRender: ({ record }) => {
      if (record.is_completed) {
        return h(Tag, { color: "success" }, () => "Completed")
      }
      return h(Tag, { color: "default" }, () => "Pending")
    },
  },
  {
    title: "Updated",
    dataIndex: "updated_at",
    key: "updated_at",
    width: 180,
    customRender: ({ text }) => new Date(text).toLocaleString(),
  },
  {
    title: "Actions",
    key: "actions",
    width: 150,
    fixed: "right",
  },
]

// Row selection config
const rowSelection = {
  selectedRowKeys: selectedIds,
  onChange: handleSelectionChange,
}

// Sort options
const sortByOptions = [
  { value: "updated_at", label: "Updated At" },
  { value: "title", label: "Title" },
]

const sortOrderOptions = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
]

// Navigate to todo detail using multi-tenant route
function viewTodo(id) {
  router.push(`/orgs/${orgId}/projects/${projectId}/todos/${id}`)
}

// Navigate to project settings page
function goToSettings() {
  router.push(`/orgs/${orgId}/projects/${projectId}/settings`)
}

// Handle delete with confirmation
async function handleDelete(id) {
  await deleteTodo(id)
}

// Handle bulk delete
async function handleBulkDelete() {
  await bulkDelete()
}

// Search input value (local ref for two-way binding)
const searchValue = ref("")

function onSearch(value) {
  handleSearch(value)
}

function clearSearch() {
  searchValue.value = ""
  handleSearch("")
}

// Handle sort by change
function onSortByChange(value) {
  handleSortChange(value, sortOrder.value)
}

// Handle sort order change
function onSortOrderChange(value) {
  handleSortChange(sortBy.value, value)
}

// Set multi-tenant context, load supporting data, then fetch todos
onMounted(async () => {
  // Set org/project context so the store scopes API calls correctly
  setContext(orgId, projectId)

  // Fetch org and project names for breadcrumb display
  fetchOrgById(orgId)
  fetchProjectById(orgId, projectId)

  // Load user permissions for this org to gate UI actions
  loadPermissions(orgId, authStore.currentUser.id)

  // Fetch the todos list
  fetchTodos()
})
</script>

<template>
  <div class="todos-list">
    <!-- Breadcrumb navigation for multi-tenant hierarchy -->
    <Breadcrumb style="margin-bottom: 16px">
      <Breadcrumb.Item>
        <router-link to="/orgs">Organizations</router-link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <router-link :to="`/orgs/${orgId}`">{{ currentOrg?.name || "..." }}</router-link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>{{ currentProject?.name || "..." }}</Breadcrumb.Item>
      <Breadcrumb.Item>Todos</Breadcrumb.Item>
    </Breadcrumb>

    <!-- Header -->
    <div class="header">
      <Typography.Title :level="4" style="margin: 0"> Todos </Typography.Title>

      <Space>
        <!-- Search -->
        <Input.Search
          v-model:value="searchValue"
          placeholder="Search todos..."
          allow-clear
          style="width: 250px"
          @search="onSearch"
        />

        <!-- Sort controls -->
        <Select
          :value="sortBy"
          :options="sortByOptions"
          style="width: 140px"
          placeholder="Sort by"
          @change="onSortByChange"
        />
        <Select
          :value="sortOrder"
          :options="sortOrderOptions"
          style="width: 130px"
          placeholder="Order"
          @change="onSortOrderChange"
        />

        <!-- Bulk delete (only visible when items are selected and user has delete permission) -->
        <Popconfirm
          v-if="hasSelected && can('todos:delete')"
          :title="`Delete ${selectedCount} selected todo(s)?`"
          ok-text="Yes"
          cancel-text="No"
          @confirm="handleBulkDelete"
        >
          <Button danger :loading="loading">
            <template #icon>
              <DeleteOutlined />
            </template>
            Delete Selected ({{ selectedCount }})
          </Button>
        </Popconfirm>

        <!-- Create button (permission-gated) -->
        <Button v-if="can('todos:create')" type="primary" @click="openCreateModal">
          <template #icon>
            <PlusOutlined />
          </template>
          Create Todo
        </Button>

        <!-- Settings button (visible if user can update or delete the project) -->
        <Button v-if="canAny(['project:update', 'project:delete'])" @click="goToSettings">
          <template #icon>
            <SettingOutlined />
          </template>
        </Button>
      </Space>
    </div>

    <!-- Loading skeleton -->
    <Skeleton v-if="loading && todos.length === 0" active :paragraph="{ rows: 5 }" />

    <!-- Empty state -->
    <Empty
      v-else-if="!loading && todos.length === 0"
      :description="searchQuery ? 'No todos match your search' : 'No todos yet'"
    >
      <Button v-if="!searchQuery && can('todos:create')" type="primary" @click="openCreateModal">
        Create your first todo
      </Button>
      <Button v-else-if="searchQuery" type="default" @click="clearSearch"> Clear search </Button>
    </Empty>

    <!-- Table -->
    <Table
      v-else
      :columns="columns"
      :data-source="todos"
      :row-key="(record) => record.id"
      :row-selection="rowSelection"
      :loading="loading"
      :pagination="{
        current: pagination.current_page,
        pageSize: pagination.items_per_page,
        total: pagination.total_items,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} items`,
        onChange: handlePageChange,
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <Space>
            <Button type="text" size="small" @click="viewTodo(record.id)">
              <template #icon>
                <EyeOutlined />
              </template>
            </Button>
            <!-- Edit button (permission-gated) -->
            <Button
              v-if="can('todos:update')"
              type="text"
              size="small"
              @click="openEditModal(record)"
            >
              <template #icon>
                <EditOutlined />
              </template>
            </Button>
            <!-- Delete button (permission-gated) -->
            <Popconfirm
              v-if="can('todos:delete')"
              title="Delete this todo?"
              ok-text="Yes"
              cancel-text="No"
              @confirm="handleDelete(record.id)"
            >
              <Button type="text" size="small" danger>
                <template #icon>
                  <DeleteOutlined />
                </template>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>

    <!-- Todo Form Modal -->
    <TodoFormModal
      :visible="isModalVisible"
      :todo="editingTodo"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>

<style scoped>
.todos-list {
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
