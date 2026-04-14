<script setup>
/**
 * OrgSettingsView — Settings page for an organization with tabbed sections.
 *
 * Tabs:
 *   1. General   — Edit org name/description, delete org
 *   2. Members   — View/manage org members and their roles
 *   3. Roles     — View/create/edit/delete custom roles and permissions
 *   4. Invitations — View sent invitations, invite new members, revoke pending invites
 *
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
  Table,
  Tag,
  Typography,
} from "ant-design-vue"
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons-vue"

import { useOrgs } from "@/composables/useOrgs"
import { useMembers } from "@/composables/useMembers"
import { useRoles } from "@/composables/useRoles"
import { useInvitations } from "@/composables/useInvitations"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import orgs store directly for the updateOrg action (not exposed via composable)
import { useOrgsStore } from "@/stores/orgs"

import MembersTable from "@/components/MembersTable.vue"
import RoleFormModal from "@/components/RoleFormModal.vue"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const orgsStore = useOrgsStore()

// Extract orgId from route params — this scopes all settings operations
const orgId = route.params.orgId

// ---------------------------------------------------------------------------
// Composable instances — use distinct names to avoid `loading` collisions
// ---------------------------------------------------------------------------
const orgsComposable = useOrgs()
const membersComposable = useMembers()
const rolesComposable = useRoles()
const invitationsComposable = useInvitations()
const { can, loadPermissions } = usePermissions()

// Destructure frequently used values for cleaner template bindings
const { currentOrg, fetchOrgById, deleteOrg } = orgsComposable
const { orgMembers, fetchOrgMembers, handleRoleChange, handleRemove } = membersComposable
const { roles, allPermissions, fetchRoles, fetchAllPermissions, deleteRole } = rolesComposable
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
const rolesLoading = computed(() => rolesComposable.loading.value)
const invitationsLoading = computed(() => invitationsComposable.loading.value)

// ---------------------------------------------------------------------------
// General tab — form state for editing org name and description
// ---------------------------------------------------------------------------
const formState = reactive({
  name: "",
  description: "",
})

// Local loading flag for the save button (separate from store loading)
const saving = ref(false)

/**
 * Watch currentOrg to populate the form when the org data arrives.
 * This ensures the form is pre-filled after the initial fetch completes.
 */
watch(
  currentOrg,
  (org) => {
    if (org) {
      formState.name = org.name || ""
      formState.description = org.description || ""
    }
  },
  { immediate: true },
)

/**
 * Save the updated org name and description.
 * Uses the orgs store directly since the composable handleSubmit
 * is designed for modal-based create/edit flows.
 */
async function handleSave() {
  saving.value = true
  try {
    await orgsStore.updateOrg(orgId, formState)
  } finally {
    saving.value = false
  }
}

/**
 * Delete the organization and navigate back to the orgs list.
 * Called after user confirms via Popconfirm.
 */
async function handleDeleteOrg() {
  await deleteOrg(orgId)
  router.push("/orgs")
}

// ---------------------------------------------------------------------------
// Members tab — event handlers
// ---------------------------------------------------------------------------

/**
 * Handle a member's role being changed via the MembersTable dropdown.
 * Delegates to the members composable with org scope.
 * @param {{ userId: string, roleId: string }} payload - The role change payload
 */
function onMemberRoleChange({ userId, roleId }) {
  handleRoleChange(orgId, userId, roleId, "org")
}

/**
 * Handle a member being removed via the MembersTable remove button.
 * Delegates to the members composable with org scope.
 * @param {string} userId - The user being removed
 */
function onMemberRemove(userId) {
  handleRemove(orgId, userId, "org")
}

// ---------------------------------------------------------------------------
// Roles tab — table columns and event handlers
// ---------------------------------------------------------------------------

/** Column definitions for the roles table */
const roleColumns = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    // Show a dash when no description is provided
    customRender: ({ text }) => {
      if (text) {
        return text
      }
      return "\u2014"
    },
  },
  {
    title: "System",
    key: "system",
    width: 100,
  },
  {
    title: "Actions",
    key: "actions",
    width: 160,
  },
]

/**
 * Handle role form submission (create or update).
 * Delegates to the roles composable which determines the correct action.
 * @param {Object} formData - Role form data from RoleFormModal
 */
function onRoleSubmit(formData) {
  rolesComposable.handleSubmit(orgId, formData)
}

// ---------------------------------------------------------------------------
// Invitations tab — event handlers
// ---------------------------------------------------------------------------

/**
 * Handle invite form submission.
 * Delegates to the invitations composable with org scope.
 * @param {Object} data - Invite payload from InviteFormModal
 */
function onInviteSubmit(data) {
  handleInvite(orgId, data, "org")
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
 * Active tab — driven by ?tab query param (defaults to "general").
 * This keeps the sidebar "Members" link (?tab=members) in sync with the tab UI.
 */
const activeTab = computed(() => route.query.tab || "general")

/**
 * Fetch the relevant data when the user switches tabs.
 * Also updates the URL query param to keep sidebar highlighting in sync.
 * This avoids loading all data up front and keeps each tab's data fresh.
 * @param {string} activeKey - The key of the newly active tab
 */
function onTabChange(activeKey) {
  // Update URL query param so sidebar highlighting stays in sync
  const query = activeKey === "general" ? {} : { tab: activeKey }
  router.replace({ path: route.path, query })

  if (activeKey === "members") {
    fetchOrgMembers(orgId)
    fetchRoles(orgId)
  } else if (activeKey === "roles") {
    fetchRoles(orgId)
    fetchAllPermissions()
  } else if (activeKey === "invitations") {
    fetchOrgInvitations(orgId)
    fetchRoles(orgId)
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  // Fetch the org details so the general form is populated
  await fetchOrgById(orgId)
  // Load permissions so `can()` checks work throughout the tabs
  loadPermissions(orgId, authStore.currentUser.id)
  // If arriving via sidebar with ?tab=members, fetch tab data immediately
  if (route.query.tab && route.query.tab !== "general") {
    onTabChange(route.query.tab)
  }
})
</script>

<template>
  <div class="org-settings">
    <!-- Page title -->
    <Typography.Title :level="4" style="margin-bottom: 24px">
      Organization Settings
    </Typography.Title>

    <!-- Tabbed settings sections -->
    <Tabs :active-key="activeTab" @change="onTabChange">
      <!-- ================================================================ -->
      <!-- Tab 1: General — org name, description, delete                   -->
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
              <!-- Save button — only shown if user can update the org -->
              <Button v-if="can('org:update')" type="primary" :loading="saving" @click="handleSave">
                Save
              </Button>

              <!-- Delete button — only shown if user can delete the org -->
              <Popconfirm
                v-if="can('org:delete')"
                title="Delete this organization? This cannot be undone."
                @confirm="handleDeleteOrg"
              >
                <Button danger>Delete Organization</Button>
              </Popconfirm>
            </Space>
          </Form.Item>
        </Form>
      </Tabs.TabPane>

      <!-- ================================================================ -->
      <!-- Tab 2: Members — list org members, change roles, remove          -->
      <!-- ================================================================ -->
      <Tabs.TabPane key="members" tab="Members">
        <MembersTable
          :members="orgMembers"
          :roles="roles"
          :loading="membersLoading"
          :can-update-role="can('org:manage_members')"
          :can-remove="can('org:manage_members')"
          @role-change="onMemberRoleChange"
          @remove="onMemberRemove"
        />
      </Tabs.TabPane>

      <!-- ================================================================ -->
      <!-- Tab 3: Roles — list roles, create/edit/delete custom roles       -->
      <!-- ================================================================ -->
      <Tabs.TabPane key="roles" tab="Roles">
        <!-- Create role button — gated by permission -->
        <div style="margin-bottom: 16px">
          <Button
            v-if="can('org:manage_roles')"
            type="primary"
            @click="rolesComposable.openCreateModal()"
          >
            <template #icon><PlusOutlined /></template>
            Create Role
          </Button>
        </div>

        <!-- Roles table -->
        <Table
          :data-source="roles"
          :loading="rolesLoading"
          :row-key="(r) => r.id"
          :columns="roleColumns"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <!-- System column: tag indicating system vs custom role -->
            <template v-if="column.key === 'system'">
              <Tag v-if="record.is_system" color="blue">System</Tag>
              <Tag v-else>Custom</Tag>
            </template>

            <!-- Actions column: edit and delete (only for non-system roles) -->
            <template v-if="column.key === 'actions'">
              <!-- System roles cannot be edited or deleted -->
              <Space v-if="!record.is_system">
                <Button
                  v-if="can('org:manage_roles')"
                  size="small"
                  @click="rolesComposable.openEditModal(record)"
                >
                  <template #icon><EditOutlined /></template>
                  Edit
                </Button>

                <Popconfirm
                  v-if="can('org:manage_roles')"
                  title="Delete this role? This cannot be undone."
                  @confirm="deleteRole(orgId, record.id)"
                >
                  <Button danger size="small">
                    <template #icon><DeleteOutlined /></template>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>

        <!-- Role create/edit modal -->
        <RoleFormModal
          :visible="rolesComposable.isModalVisible.value"
          :role="rolesComposable.editingRole.value"
          :permissions="allPermissions"
          :loading="rolesLoading"
          @submit="onRoleSubmit"
          @cancel="rolesComposable.closeModal()"
        />
      </Tabs.TabPane>

      <!-- ================================================================ -->
      <!-- Tab 4: Invitations — list invitations, invite, revoke            -->
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
.org-settings {
  width: 100%;
}
</style>
