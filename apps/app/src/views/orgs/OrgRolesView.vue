<script setup>
/**
 * OrgRolesView — organization roles list with create, edit and delete.
 *
 * Extracted from the Roles tab of OrgSettingsView. System roles are never
 * editable or deletable; that guard lives in the template, unchanged.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { Button, Space, Popconfirm, Table, Tag, Typography } from "ant-design-vue"
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons-vue"

import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import RoleFormModal from "@/components/RoleFormModal.vue"

const route = useRoute()
const authStore = useAuthStore()
const orgId = route.params.orgId

const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()
const { roles, allPermissions, fetchRoles, fetchAllPermissions, deleteRole } = rolesComposable

const rolesLoading = computed(() => rolesComposable.loading.value)

/** Column definitions for the roles table */
const roleColumns = [
  { title: "Name", dataIndex: "name", key: "name" },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    // Show a dash when no description is provided
    customRender: ({ text }) => {
      if (text) {
        return text
      }
      return "—"
    },
  },
  { title: "System", key: "system", width: 100 },
  { title: "Actions", key: "actions", width: 160 },
]

/** @param {Object} formData - Role form data from RoleFormModal */
function onRoleSubmit(formData) {
  rolesComposable.handleSubmit(orgId, formData)
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchRoles(orgId)
  fetchAllPermissions()
})
</script>

<template>
  <div class="org-roles">
    <Typography.Title :level="4" style="margin-bottom: 24px">Roles</Typography.Title>

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

    <Table
      :data-source="roles"
      :loading="rolesLoading"
      :row-key="(r) => r.id"
      :columns="roleColumns"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'system'">
          <Tag v-if="record.is_system" color="blue">System</Tag>
          <Tag v-else>Custom</Tag>
        </template>

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

    <RoleFormModal
      :visible="rolesComposable.isModalVisible.value"
      :role="rolesComposable.editingRole.value"
      :permissions="allPermissions"
      :loading="rolesLoading"
      @submit="onRoleSubmit"
      @cancel="rolesComposable.closeModal()"
    />
  </div>
</template>

<style scoped>
.org-roles {
  width: 100%;
}
</style>
