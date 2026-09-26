<script setup lang="ts">
/**
 * OrgMembersView — organization members list with inline role change and removal.
 *
 * Extracted from the Members tab of OrgSettingsView. The table markup is
 * unchanged; the difference is that data loads on mount rather than on tab click.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"

import { useMembers } from "@/composables/useMembers"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import MembersTable from "@/components/MembersTable.vue"
import PageHeader from "@/components/PageHeader.vue"

const route = useRoute()
const authStore = useAuthStore()

// Captured once at setup — this view remounts when :orgId changes.
const orgId = String(route.params.orgId)

const membersComposable = useMembers()
const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()

const { orgMembers, fetchOrgMembers, handleRoleChange, handleRemove } = membersComposable
const { roles, fetchRoles } = rolesComposable

const membersLoading = computed(() => membersComposable.loading.value)

function onMemberRoleChange({ userId, roleId }: { userId: string; roleId: string }): void {
  handleRoleChange(orgId, userId, roleId, "org")
}

function onMemberRemove(userId: string): void {
  handleRemove(orgId, userId, "org")
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchOrgMembers(orgId)
  // Roles feed the inline role-change dropdown in MembersTable.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Members" />
    <MembersTable
      :members="orgMembers"
      :roles="roles"
      :loading="membersLoading"
      :can-update-role="can('org:manage_members')"
      :can-remove="can('org:manage_members')"
      @role-change="onMemberRoleChange"
      @remove="onMemberRemove"
    />
  </div>
</template>
