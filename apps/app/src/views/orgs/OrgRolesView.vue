<script setup lang="ts">
/**
 * OrgRolesView — organization roles list with create, edit and delete.
 *
 * Extracted from the Roles tab of OrgSettingsView. System roles are never
 * editable or deletable; that guard lives in the template, unchanged.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { Pencil, Plus, Trash2 } from "@lucide/vue"

import type { RoleFormInput } from "@/api/roles"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import RoleFormModal from "@/components/RoleFormModal.vue"
import PageHeader from "@/components/PageHeader.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import TableSkeletonRows from "@/components/TableSkeletonRows.vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const route = useRoute()
const authStore = useAuthStore()
const orgId = String(route.params.orgId)

const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()
const { roles, allPermissions, fetchRoles, fetchAllPermissions, deleteRole } = rolesComposable

const rolesLoading = computed(() => rolesComposable.loading.value)
const canManageRoles = computed(() => can("org:manage_roles"))

/** Role form data from RoleFormModal */
function onRoleSubmit(formData: RoleFormInput): void {
  rolesComposable.handleSubmit(orgId, formData)
}

// The row lookup in `roles` avoids a type assertion on the row.
function editRole(roleId: string): void {
  const role = roles.value.find((candidate) => candidate.id === roleId)
  if (role) {
    rolesComposable.openEditModal(role)
  }
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchRoles(orgId)
  fetchAllPermissions()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Roles" :loading="rolesLoading && roles.length > 0">
      <Button v-if="can('org:manage_roles')" @click="rolesComposable.openCreateModal()">
        <Plus /> Create Role
      </Button>
    </PageHeader>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[180px]">Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead class="w-[120px]">Permissions</TableHead>
          <TableHead class="w-[110px]">System</TableHead>
          <TableHead v-if="canManageRoles" class="w-[1%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableSkeletonRows
          v-if="rolesLoading && roles.length === 0"
          :rows="4"
          :columns="[{ width: 90 }, { width: 240 }, { width: 24 }, { width: 60 }]"
        />
        <TableRow v-for="role in roles" :key="role.id">
          <TableCell class="font-medium whitespace-nowrap">{{ role.name }}</TableCell>
          <TableCell class="text-muted-foreground">{{ role.description || "—" }}</TableCell>
          <TableCell data-slot="role-perm-count" class="tabular-nums">{{
            role.permissions.length
          }}</TableCell>
          <TableCell>
            <Badge v-if="role.is_system" variant="info">System</Badge>
            <Badge v-else variant="secondary">Custom</Badge>
          </TableCell>
          <TableCell v-if="canManageRoles" class="w-[1%] text-right">
            <div v-if="!role.is_system" class="flex items-center justify-end gap-0.5">
              <Button size="sm" variant="outline" @click="editRole(role.id)">
                <Pencil /> Edit
              </Button>
              <ConfirmDialog
                title="Delete this role? This cannot be undone."
                confirm-label="Delete"
                destructive
                :action="() => deleteRole(orgId, role.id)"
              >
                <Button size="sm" variant="destructive"><Trash2 /> Delete</Button>
              </ConfirmDialog>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <RoleFormModal
      :open="rolesComposable.isModalVisible.value"
      :role="rolesComposable.editingRole.value"
      :permissions="allPermissions"
      :loading="rolesLoading"
      @submit="onRoleSubmit"
      @cancel="rolesComposable.closeModal()"
    />
  </div>
</template>
