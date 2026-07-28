<script setup lang="ts">
/**
 * OrgSettingsView — General settings for an organization (name, description, delete).
 *
 * Members, roles, and invitations now live on their own routes/views:
 * `OrgMembersView`, `OrgRolesView`, and `OrgInvitationsView`.
 */

import { reactive, ref, watch, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Form, Input, Button, Space, Popconfirm, Typography } from "ant-design-vue"

import { useOrgs } from "@/composables/useOrgs"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
// Import orgs store directly for the updateOrg action (not exposed via composable)
import { useOrgsStore } from "@/stores/orgs"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const orgsStore = useOrgsStore()

// Extract orgId from route params — this scopes all settings operations
const orgId = String(route.params.orgId)

const { currentOrg, fetchOrgById, deleteOrg } = useOrgs()
const { can, loadPermissions } = usePermissions()

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
async function handleSave(): Promise<void> {
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
async function handleDeleteOrg(): Promise<void> {
  await deleteOrg(orgId)
  router.push("/orgs")
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await fetchOrgById(orgId)
  // TODO(ts-migration): this read was unguarded and would have thrown on a null user. `?.` matches
  // the other views. No observable change — `usePermissions` names the parameter `_userId` and
  // discards it.
  loadPermissions(orgId, authStore.currentUser?.id)
})
</script>

<template>
  <div class="org-settings">
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
  </div>
</template>

<style scoped>
.org-settings {
  width: 100%;
}
</style>
