<script setup>
/**
 * ProjectSettingsView — General settings for a project.
 *
 * Edit project name/description, delete project.
 *
 * Members and invitations live on their own routes now:
 *   - ProjectMembersView.vue     (/orgs/:orgId/projects/:projectId/members)
 *   - ProjectInvitationsView.vue (/orgs/:orgId/projects/:projectId/invitations)
 *
 * Note: Roles are managed at the org level only, so there is no Roles route here.
 * Permissions are loaded on mount and used to gate edit/delete actions via the
 * `can()` helper from usePermissions.
 */

import { reactive, ref, watch, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Form, Input, Button, Space, Popconfirm, Typography } from "ant-design-vue"

import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import projects store directly for the updateProject action (not exposed via composable)
import { useProjectsStore } from "@/stores/projects"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()

// Extract orgId and projectId from route params — these scope all operations
const orgId = route.params.orgId
const projectId = route.params.projectId

// ---------------------------------------------------------------------------
// Composable instances
// ---------------------------------------------------------------------------
const orgsComposable = useOrgs()
const projectsComposable = useProjects()
const { can, loadPermissions } = usePermissions()

// Destructure frequently used values for cleaner template bindings
const { fetchOrgById } = orgsComposable
const { currentProject, fetchProjectById, deleteProject } = projectsComposable

// ---------------------------------------------------------------------------
// General — form state for editing project name and description
// ---------------------------------------------------------------------------
const formState = reactive({
  name: "",
  description: "",
})

// Local loading flag for the save button (separate from store loading)
const saving = ref(false)

/**
 * Watch currentProject to populate the form when the project data arrives.
 * This ensures the form is pre-filled after the initial fetch completes.
 */
watch(
  currentProject,
  (project) => {
    if (project) {
      formState.name = project.name || ""
      formState.description = project.description || ""
    }
  },
  { immediate: true },
)

/**
 * Save the updated project name and description.
 * Uses the projects store directly since the composable handleSubmit
 * is designed for modal-based create/edit flows.
 */
async function handleSave() {
  saving.value = true
  try {
    await projectsStore.updateProject(orgId, projectId, formState)
  } finally {
    saving.value = false
  }
}

/**
 * Delete the project and navigate back to the org's projects list.
 * Called after user confirms via Popconfirm.
 */
async function handleDeleteProject() {
  await deleteProject(orgId, projectId)
  router.push(`/orgs/${orgId}`)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await fetchOrgById(orgId)
  await fetchProjectById(orgId, projectId)
  loadPermissions(orgId, authStore.currentUser.id)
})
</script>

<template>
  <div class="project-settings">
    <!-- Page title -->
    <Typography.Title :level="4" style="margin-bottom: 24px"> General </Typography.Title>

    <Form :model="formState" layout="vertical" style="max-width: 600px">
      <Form.Item
        label="Name"
        name="name"
        :rules="[{ required: true, message: 'Name is required' }]"
      >
        <Input v-model:value="formState.name" />
      </Form.Item>

      <Form.Item label="Description" name="description">
        <Input.TextArea v-model:value="formState.description" :rows="3" />
      </Form.Item>

      <Form.Item>
        <Space>
          <!-- Save button — only shown if user can update the project -->
          <Button v-if="can('project:update')" type="primary" :loading="saving" @click="handleSave">
            Save
          </Button>

          <!-- Delete button — only shown if user can delete the project -->
          <Popconfirm
            v-if="can('project:delete')"
            title="Delete this project? This cannot be undone."
            @confirm="handleDeleteProject"
          >
            <Button danger>Delete Project</Button>
          </Popconfirm>
        </Space>
      </Form.Item>
    </Form>
  </div>
</template>

<style scoped>
.project-settings {
  width: 100%;
}
</style>
