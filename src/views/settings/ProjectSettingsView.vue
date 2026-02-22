<script setup>
/**
 * ProjectSettingsView — Settings page for a project with tabbed sections.
 *
 * Tabs:
 *   1. General     — Edit project name/description, delete project
 *   2. Members     — View/manage project members and their roles
 *   3. Invitations — View sent invitations, invite new members, revoke pending invites
 *
 * Note: Roles are managed at the org level only, so there is no Roles tab here.
 * Permissions are loaded on mount and used to gate edit/delete/create actions
 * throughout all tabs via the `can()` helper from usePermissions.
 */

import { reactive, ref, computed, watch, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  Tabs,
  Form,
  Input,
  Button,
  Space,
  Popconfirm,
  Typography,
  Breadcrumb,
} from "ant-design-vue"
import { PlusOutlined } from "@ant-design/icons-vue"

import { useOrgs } from "@/composables/useOrgs"
import { useProjects } from "@/composables/useProjects"
import { useMembers } from "@/composables/useMembers"
import { useRoles } from "@/composables/useRoles"
import { useInvitations } from "@/composables/useInvitations"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import projects store directly for the updateProject action (not exposed via composable)
import { useProjectsStore } from "@/stores/projects"

import MembersTable from "@/components/MembersTable.vue"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()

// Extract orgId and projectId from route params — these scope all operations
const orgId = route.params.orgId
const projectId = route.params.projectId

// ---------------------------------------------------------------------------
// Composable instances — use distinct names to avoid `loading` collisions
// ---------------------------------------------------------------------------
const orgsComposable = useOrgs()
const projectsComposable = useProjects()
const membersComposable = useMembers()
const rolesComposable = useRoles()
const invitationsComposable = useInvitations()
const { can, loadPermissions } = usePermissions()

// Destructure frequently used values for cleaner template bindings
const { currentOrg, fetchOrgById } = orgsComposable
const { currentProject, fetchProjectById, deleteProject } = projectsComposable
const { projectMembers, fetchProjectMembers, handleRoleChange, handleRemove } = membersComposable
const { roles, fetchRoles } = rolesComposable
const {
  orgInvitations,
  fetchOrgInvitations,
  isInviteModalVisible,
  openInviteModal,
  closeInviteModal,
  handleInvite,
  handleRevoke,
} = invitationsComposable

// ---------------------------------------------------------------------------
// Loading state — compute from each composable to avoid naming collisions
// ---------------------------------------------------------------------------
const membersLoading = computed(() => membersComposable.loading.value)
const invitationsLoading = computed(() => invitationsComposable.loading.value)

// ---------------------------------------------------------------------------
// General tab — form state for editing project name and description
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
// Members tab — event handlers
// ---------------------------------------------------------------------------

/**
 * Handle a member's role being changed via the MembersTable dropdown.
 * Delegates to the members composable with project scope.
 * @param {{ userId: string, roleId: string }} payload - The role change payload
 */
function onMemberRoleChange({ userId, roleId }) {
  handleRoleChange(orgId, userId, roleId, "project", projectId)
}

/**
 * Handle a member being removed via the MembersTable remove button.
 * Delegates to the members composable with project scope.
 * @param {string} userId - The user being removed
 */
function onMemberRemove(userId) {
  handleRemove(orgId, userId, "project", projectId)
}

// ---------------------------------------------------------------------------
// Invitations tab — event handlers
// ---------------------------------------------------------------------------

/**
 * Handle invite form submission.
 * Delegates to the invitations composable with project scope.
 * @param {Object} data - Invite payload from InviteFormModal
 */
function onInviteSubmit(data) {
  handleInvite(orgId, data, "project", projectId)
}

/**
 * Handle revoking a pending invitation.
 * @param {string} invitationId - The invitation being revoked
 */
function onRevoke(invitationId) {
  handleRevoke(orgId, invitationId)
}

// ---------------------------------------------------------------------------
// Tab change handler — fetch data lazily when a tab is activated
// ---------------------------------------------------------------------------

/**
 * Fetch the relevant data when the user switches tabs.
 * Uses project-scoped fetches for members.
 * @param {string} activeKey - The key of the newly active tab
 */
function onTabChange(activeKey) {
  if (activeKey === "members") {
    fetchProjectMembers(orgId, projectId)
    // Roles are org-level but needed for the role dropdown in MembersTable
    fetchRoles(orgId)
  } else if (activeKey === "invitations") {
    fetchOrgInvitations(orgId)
    // Roles needed for the invite modal role selector
    fetchRoles(orgId)
  }
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Navigate back to the organizations list */
function goToOrgs() {
  router.push("/orgs")
}

/** Navigate to this org's projects list */
function goToOrgProjects() {
  router.push(`/orgs/${orgId}`)
}

/** Navigate to this project's todos list */
function goToProjectTodos() {
  router.push(`/orgs/${orgId}/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  // Fetch org and project details so breadcrumbs and the general form are populated
  await fetchOrgById(orgId)
  await fetchProjectById(orgId, projectId)
  // Load permissions so `can()` checks work throughout the tabs
  loadPermissions(orgId, authStore.currentUser.id)
})
</script>

<template>
  <div class="project-settings">
    <!-- Breadcrumb: Organizations > [Org Name] > [Project Name] > Settings -->
    <Breadcrumb style="margin-bottom: 16px">
      <Breadcrumb.Item>
        <a @click="goToOrgs">Organizations</a>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <a @click="goToOrgProjects">
          <template v-if="currentOrg">{{ currentOrg.name }}</template>
          <template v-else>...</template>
        </a>
      </Breadcrumb.Item>
      <Breadcrumb.Item>
        <a @click="goToProjectTodos">
          <template v-if="currentProject">{{ currentProject.name }}</template>
          <template v-else>...</template>
        </a>
      </Breadcrumb.Item>
      <Breadcrumb.Item>Settings</Breadcrumb.Item>
    </Breadcrumb>

    <!-- Page title -->
    <Typography.Title :level="4" style="margin-bottom: 24px"> Project Settings </Typography.Title>

    <!-- Tabbed settings sections -->
    <Tabs default-active-key="general" @change="onTabChange">
      <!-- ================================================================ -->
      <!-- Tab 1: General — project name, description, delete               -->
      <!-- ================================================================ -->
      <Tabs.TabPane key="general" tab="General">
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
              <Button
                v-if="can('project:update')"
                type="primary"
                :loading="saving"
                @click="handleSave"
              >
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
      </Tabs.TabPane>

      <!-- ================================================================ -->
      <!-- Tab 2: Members — list project members, change roles, remove      -->
      <!-- ================================================================ -->
      <Tabs.TabPane key="members" tab="Members">
        <MembersTable
          :members="projectMembers"
          :roles="roles"
          :loading="membersLoading"
          :can-update-role="can('project:manage_members')"
          :can-remove="can('project:manage_members')"
          @role-change="onMemberRoleChange"
          @remove="onMemberRemove"
        />
      </Tabs.TabPane>

      <!-- ================================================================ -->
      <!-- Tab 3: Invitations — list invitations, invite, revoke            -->
      <!-- ================================================================ -->
      <Tabs.TabPane key="invitations" tab="Invitations">
        <!-- Invite member button — gated by permission -->
        <div style="margin-bottom: 16px">
          <Button v-if="can('invitations:create')" type="primary" @click="openInviteModal()">
            <template #icon><PlusOutlined /></template>
            Invite Member
          </Button>
        </div>

        <!-- Invitations table with revoke support -->
        <InvitationsTable
          :invitations="orgInvitations"
          :loading="invitationsLoading"
          :can-revoke="can('invitations:manage')"
          @revoke="onRevoke"
        />

        <!-- Invite member modal -->
        <InviteFormModal
          :visible="isInviteModalVisible"
          :roles="roles"
          :loading="invitationsLoading"
          @submit="onInviteSubmit"
          @cancel="closeInviteModal()"
        />
      </Tabs.TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.project-settings {
  width: 100%;
}
</style>
