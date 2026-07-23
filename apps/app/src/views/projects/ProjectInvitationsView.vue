<script setup>
/**
 * ProjectInvitationsView — invite people into a project.
 *
 * Extracted from the Invitations tab of ProjectSettingsView. The table lists
 * ORG invitations: no project-scoped listing endpoint exists. Sending an invite
 * is project-scoped. That asymmetry is pre-existing and deliberate here.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { Button, Typography } from "ant-design-vue"
import { PlusOutlined } from "@ant-design/icons-vue"

import { useInvitations } from "@/composables/useInvitations"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"

const route = useRoute()
const authStore = useAuthStore()

const orgId = route.params.orgId
const projectId = route.params.projectId

const invitationsComposable = useInvitations()
const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()

const {
  orgInvitations,
  fetchOrgInvitations,
  isInviteModalVisible,
  openInviteModal,
  closeInviteModal,
  handleInvite,
  handleRevoke,
} = invitationsComposable
const { roles, fetchRoles } = rolesComposable

const invitationsLoading = computed(() => invitationsComposable.loading.value)

/** @param {Object} data - Invite payload from InviteFormModal */
function onInviteSubmit(data) {
  handleInvite(orgId, data, "project", projectId)
}

/** @param {string} invitationId */
function onRevoke(invitationId) {
  handleRevoke(orgId, invitationId)
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchOrgInvitations(orgId)
  // Roles feed the role dropdown inside InviteFormModal.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="project-invitations">
    <Typography.Title :level="4" style="margin-bottom: 24px">Invitations</Typography.Title>

    <!-- Invite member button — gated by permission -->
    <div style="margin-bottom: 16px">
      <Button v-if="can('invitations:create')" type="primary" @click="openInviteModal()">
        <template #icon><PlusOutlined /></template>
        Invite Member
      </Button>
    </div>

    <InvitationsTable
      :invitations="orgInvitations"
      :loading="invitationsLoading"
      :can-revoke="can('invitations:manage')"
      @revoke="onRevoke"
    />

    <InviteFormModal
      :visible="isInviteModalVisible"
      :roles="roles"
      :loading="invitationsLoading"
      @submit="onInviteSubmit"
      @cancel="closeInviteModal()"
    />
  </div>
</template>

<style scoped>
.project-invitations {
  width: 100%;
}
</style>
