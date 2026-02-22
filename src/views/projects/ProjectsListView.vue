<script setup>
/**
 * ProjectsListView — Displays projects belonging to a specific organization.
 *
 * Features:
 *   - Reads orgId from route params to scope all operations
 *   - Breadcrumb navigation back to the organizations list
 *   - Fetches the org (for name/title), projects list, and user permissions on mount
 *   - Permission-gated Settings and Create Project buttons
 *   - Skeleton loading state while data is being fetched
 *   - Empty state with a prompt to create the first project
 *   - Responsive card grid matching OrgsListView layout
 *   - ProjectFormModal for creating new projects (scoped to the current org)
 */

import { onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Empty,
  Skeleton,
  Space,
  Breadcrumb,
} from "ant-design-vue"
import { PlusOutlined, SettingOutlined } from "@ant-design/icons-vue"
import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import ProjectFormModal from "@/components/ProjectFormModal.vue"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Extract orgId from route params — this scopes all project operations
const orgId = route.params.orgId

const { currentOrg, fetchOrgById } = useOrgs()

const {
  projects,
  loading,
  isModalVisible,
  editingProject,
  openCreateModal,
  closeModal,
  handleSubmit,
  fetchProjects,
} = useProjects()

const { can, canAny, loadPermissions } = usePermissions()

/**
 * Navigate to the todos list for a specific project within this org.
 * @param {string} projectId - Project UUID to navigate to
 */
function viewTodos(projectId) {
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

/**
 * Navigate to the organization settings page.
 * Only accessible to users with org:update or org:delete permissions.
 */
function goToSettings() {
  router.push(`/orgs/${orgId}/settings`)
}

/**
 * Navigate back to the organizations list.
 */
function goToOrgs() {
  router.push("/orgs")
}

/**
 * Wrapper around the projects composable handleSubmit that injects the orgId.
 * The composable expects (orgId, formData) because projects are org-scoped.
 * @param {Object} formData - Form data from ProjectFormModal (name, description)
 */
async function onSubmit(formData) {
  await handleSubmit(orgId, formData)
}

// Fetch org details, projects, and permissions in parallel on mount
onMounted(async () => {
  fetchOrgById(orgId)
  fetchProjects(orgId)
  loadPermissions(orgId, authStore.currentUser.id)
})
</script>

<template>
  <div class="projects-list">
    <!-- Breadcrumb navigation -->
    <Breadcrumb style="margin-bottom: 16px">
      <Breadcrumb.Item>
        <a @click="goToOrgs">Organizations</a>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <!-- Show org name once loaded, fallback to "..." while loading -->
        <template v-if="currentOrg">{{ currentOrg.name }}</template>
        <template v-else>...</template>
      </Breadcrumb.Item>
    </Breadcrumb>

    <!-- Header row with org title and action buttons -->
    <div class="header">
      <Typography.Title :level="4" style="margin: 0">
        <template v-if="currentOrg">{{ currentOrg.name }}</template>
        <template v-else>Organization</template>
      </Typography.Title>

      <Space>
        <!-- Settings gear — only visible with org:update or org:delete permission -->
        <Button v-if="canAny(['org:update', 'org:delete'])" @click="goToSettings">
          <template #icon>
            <SettingOutlined />
          </template>
          Settings
        </Button>

        <!-- Create project — only visible with project:create permission -->
        <Button v-if="can('project:create')" type="primary" @click="openCreateModal">
          <template #icon>
            <PlusOutlined />
          </template>
          Create Project
        </Button>
      </Space>
    </div>

    <!-- Loading skeleton shown while fetching and no projects are cached yet -->
    <Skeleton v-if="loading && projects.length === 0" active :paragraph="{ rows: 3 }" />

    <!-- Empty state when loading is complete but there are no projects -->
    <Empty v-else-if="!loading && projects.length === 0" description="No projects yet">
      <Button v-if="can('project:create')" type="primary" @click="openCreateModal">
        Create your first project
      </Button>
    </Empty>

    <!-- Responsive card grid showing all projects -->
    <Row v-else :gutter="[16, 16]">
      <Col v-for="project in projects" :key="project.id" :xs="24" :sm="12" :md="8" :lg="6">
        <Card class="project-card" :title="project.name" hoverable>
          <!-- Card body: description or fallback text -->
          <p v-if="project.description">{{ project.description }}</p>
          <p v-else class="no-description">No description</p>

          <!-- Card footer action -->
          <template #actions>
            <Button type="link" @click="viewTodos(project.id)">View Todos</Button>
          </template>
        </Card>
      </Col>
    </Row>

    <!-- Create / Edit project modal -->
    <ProjectFormModal
      :visible="isModalVisible"
      :project="editingProject"
      :loading="loading"
      @submit="onSubmit"
      @cancel="closeModal"
    />
  </div>
</template>

<style scoped>
.projects-list {
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

.project-card {
  height: 100%;
}

.no-description {
  color: rgba(0, 0, 0, 0.45);
  font-style: italic;
}
</style>
