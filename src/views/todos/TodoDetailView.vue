<script setup>
import { onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Breadcrumb,
  Spin,
  Popconfirm,
  Result,
} from "ant-design-vue"
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons-vue"
import { useTodos } from "@/composables/useTodos"
import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import TodoFormModal from "@/components/TodoFormModal.vue"

const route = useRoute()
const router = useRouter()

// Extract multi-tenant identifiers and todo ID from route params
const orgId = route.params.orgId
const projectId = route.params.projectId
const todoId = route.params.id

const {
  currentTodo,
  loading,
  isModalVisible,
  editingTodo,
  fetchTodoById,
  deleteTodo,
  clearCurrentTodo,
  openEditModal,
  closeModal,
  handleSubmit,
  setContext,
} = useTodos()

const { fetchOrgById, currentOrg } = useOrgs()
const { fetchProjectById, currentProject } = useProjects()
const { can, loadPermissions } = usePermissions()
const authStore = useAuthStore()

// Set multi-tenant context and load supporting data before fetching the todo
onMounted(async () => {
  // Scope API calls to the correct org/project
  setContext(orgId, projectId)

  // Fetch org and project names for breadcrumb display
  fetchOrgById(orgId)
  fetchProjectById(orgId, projectId)

  // Load user permissions for this org to gate UI actions
  loadPermissions(orgId, authStore.currentUser.id)

  // Fetch the individual todo
  await fetchTodoById(todoId)
})

// Clear current todo when navigating away (route param disappears)
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (oldId && !newId) {
      clearCurrentTodo()
    }
  },
)

// Navigate back to the project-level todos list
function goBack() {
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

// Handle edit
function handleEdit() {
  if (currentTodo.value) {
    openEditModal(currentTodo.value)
  }
}

// Handle delete, then redirect back to project
async function handleDelete() {
  await deleteTodo(todoId)
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

// Format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleString()
}
</script>

<template>
  <div class="todo-detail">
    <!-- Breadcrumb navigation for multi-tenant hierarchy -->
    <Breadcrumb style="margin-bottom: 16px">
      <Breadcrumb.Item>
        <router-link to="/orgs">Organizations</router-link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <router-link :to="`/orgs/${orgId}`">{{ currentOrg?.name || "..." }}</router-link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <router-link :to="`/orgs/${orgId}/projects/${projectId}`">
          {{ currentProject?.name || "..." }}
        </router-link>
      </Breadcrumb.Item>
      <Breadcrumb.Item>{{ currentTodo?.title || "Detail" }}</Breadcrumb.Item>
    </Breadcrumb>

    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <Spin size="large" />
    </div>

    <!-- Not found state -->
    <Result
      v-else-if="!currentTodo"
      status="404"
      title="Todo not found"
      sub-title="The todo you're looking for doesn't exist or has been deleted."
    >
      <template #extra>
        <Button type="primary" @click="goBack"> Back to Todos </Button>
      </template>
    </Result>

    <!-- Todo content -->
    <template v-else>
      <!-- Header with actions -->
      <div class="header">
        <Space>
          <Button @click="goBack">
            <template #icon>
              <ArrowLeftOutlined />
            </template>
            Back
          </Button>
        </Space>

        <Space>
          <!-- Edit button (permission-gated) -->
          <Button v-if="can('todos:update')" type="primary" @click="handleEdit">
            <template #icon>
              <EditOutlined />
            </template>
            Edit
          </Button>
          <!-- Delete button (permission-gated) -->
          <Popconfirm
            v-if="can('todos:delete')"
            title="Delete this todo?"
            ok-text="Yes"
            cancel-text="No"
            @confirm="handleDelete"
          >
            <Button danger>
              <template #icon>
                <DeleteOutlined />
              </template>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <!-- Todo details -->
      <Typography.Title :level="4" style="margin-top: 24px">
        {{ currentTodo.title }}
      </Typography.Title>

      <Descriptions bordered column="1" style="margin-top: 16px">
        <Descriptions.Item label="Status">
          <Tag v-if="currentTodo.is_completed" color="success">Completed</Tag>
          <Tag v-else color="default">Pending</Tag>
        </Descriptions.Item>

        <Descriptions.Item label="Description">
          {{ currentTodo.description || "No description" }}
        </Descriptions.Item>

        <Descriptions.Item label="Created At">
          {{ formatDate(currentTodo.created_at) }}
        </Descriptions.Item>

        <Descriptions.Item label="Updated At">
          {{ formatDate(currentTodo.updated_at) }}
        </Descriptions.Item>

        <Descriptions.Item label="ID">
          <Typography.Text code>{{ currentTodo.id }}</Typography.Text>
        </Descriptions.Item>
      </Descriptions>
    </template>

    <!-- Edit Modal -->
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
.todo-detail {
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
</style>
