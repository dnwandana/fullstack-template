<script setup lang="ts">
/**
 * OrgInvitationsView — sent invitations for an organization, with invite,
 * revoke and reissue.
 *
 * Extracted from the Invitations tab of OrgSettingsView. The table markup is
 * unchanged; data loads on mount rather than on tab click.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { Button, Typography, Modal, message } from "ant-design-vue"
import { PlusOutlined } from "@ant-design/icons-vue"

import type { InviteInput } from "@/api/invitations"
import { useInvitations } from "@/composables/useInvitations"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"

const route = useRoute()
const authStore = useAuthStore()
const orgId = String(route.params.orgId)

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
  handleResend,
} = invitationsComposable
const { roles, fetchRoles } = rolesComposable

const invitationsLoading = computed(() => invitationsComposable.loading.value)

/** Invite payload from InviteFormModal */
function onInviteSubmit(data: InviteInput): void {
  handleInvite(orgId, data, "org")
}

function onRevoke(invitationId: string): void {
  handleRevoke(orgId, invitationId)
}

/**
 * Reissue a pending invitation and put the fresh link on the clipboard.
 * The template ships no mail provider, so the admin delivers the link by hand —
 * and the raw token is only ever returned once, at the moment it is minted.
 */
async function onResend(invitationId: string): Promise<void> {
  const result = await handleResend(orgId, invitationId)
  if (!result?.accept_url) {
    return
  }

  try {
    await navigator.clipboard.writeText(result.accept_url)
    message.success("Invitation link copied to clipboard")
  } catch {
    // navigator.clipboard requires a secure context — it works over https and
    // on http://localhost, but not on a plain-HTTP LAN address. Show the link
    // instead of losing it: this token is never retrievable again.
    Modal.info({
      title: "New invitation link",
      content: result.accept_url,
    })
  }
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchOrgInvitations(orgId)
  // Roles feed the role dropdown inside InviteFormModal.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="org-invitations">
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
      :can-resend="can('invitations:manage')"
      @revoke="onRevoke"
      @resend="onResend"
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
.org-invitations {
  width: 100%;
}
</style>
