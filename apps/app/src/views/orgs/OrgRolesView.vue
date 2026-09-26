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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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
    <PageHeader title="Roles">
      <Button v-if="can('org:manage_roles')" @click="rolesComposable.openCreateModal()">
        <Plus /> Create Role
      </Button>
    </PageHeader>

    <div class="relative rounded-md border">
      <Spinner v-if="rolesLoading" class="absolute top-2 right-2" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead class="w-[100px]">System</TableHead>
            <TableHead class="w-[160px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="role in roles" :key="role.id">
            <TableCell>{{ role.name }}</TableCell>
            <TableCell>{{ role.description || "—" }}</TableCell>
            <TableCell>
              <Badge v-if="role.is_system" variant="info">System</Badge>
              <Badge v-else variant="secondary">Custom</Badge>
            </TableCell>
            <TableCell>
              <div
                v-if="!role.is_system && can('org:manage_roles')"
                class="flex items-center gap-2"
              >
                <Button size="sm" variant="outline" @click="editRole(role.id)">
                  <Pencil /> Edit
                </Button>
                <ConfirmDialog
                  title="Delete this role? This cannot be undone."
                  confirm-label="Delete"
                  destructive
                  @confirm="deleteRole(orgId, role.id)"
                >
                  <Button size="sm" variant="destructive"><Trash2 /> Delete</Button>
                </ConfirmDialog>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

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
