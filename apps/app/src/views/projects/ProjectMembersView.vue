<script setup>
/**
 * ProjectMembersView — project members list with inline role change and removal.
 *
 * Extracted from the Members tab of ProjectSettingsView. Roles come from the
 * org: project members reuse org roles, and roles.org_id is NOT NULL.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { Typography } from "ant-design-vue"

import { useMembers } from "@/composables/useMembers"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import MembersTable from "@/components/MembersTable.vue"

const route = useRoute()
const authStore = useAuthStore()

// Captured once at setup — this view remounts when either param changes.
const orgId = route.params.orgId
const projectId = route.params.projectId

const membersComposable = useMembers()
const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()

const { projectMembers, fetchProjectMembers, handleRoleChange, handleRemove } = membersComposable
const { roles, fetchRoles } = rolesComposable

const membersLoading = computed(() => membersComposable.loading.value)

/** @param {{ userId: string, roleId: string }} payload */
function onMemberRoleChange({ userId, roleId }) {
  handleRoleChange(orgId, userId, roleId, "project", projectId)
}

/** @param {string} userId */
function onMemberRemove(userId) {
  handleRemove(orgId, userId, "project", projectId)
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchProjectMembers(orgId, projectId)
  // Roles are org-level but feed the dropdown in MembersTable.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="project-members">
    <Typography.Title :level="4" style="margin-bottom: 24px">Members</Typography.Title>

    <MembersTable
      :members="projectMembers"
      :roles="roles"
      :loading="membersLoading"
      :can-update-role="can('project:manage_members')"
      :can-remove="can('project:manage_members')"
      @role-change="onMemberRoleChange"
      @remove="onMemberRemove"
    />
  </div>
</template>

<style scoped>
.project-members {
  width: 100%;
}
</style>
