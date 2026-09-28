<script setup lang="ts">
/**
 * ProjectInvitationsView — invite people into a project.
 *
 * Extracted from the Invitations tab of ProjectSettingsView. The table lists
 * ORG invitations: no project-scoped listing endpoint exists. Sending an invite
 * is project-scoped. That asymmetry is pre-existing and deliberate here.
 * The "New link" flow is the same as on the org page.
 */

import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import { UserPlus } from "@lucide/vue"

import { useInvitations } from "@/composables/useInvitations"
import { useRoles } from "@/composables/useRoles"
import { usePermissions } from "@/composables/usePermissions"
import { useAuthStore } from "@/stores/auth"
import InviteFormModal from "@/components/InviteFormModal.vue"
import InvitationsTable from "@/components/InvitationsTable.vue"
import InviteLinkDialog from "@/components/InviteLinkDialog.vue"
import PageHeader from "@/components/PageHeader.vue"
import { Button } from "@/components/ui/button"
import type { InviteInput } from "@/api/invitations"

const route = useRoute()
const authStore = useAuthStore()

const orgId = String(route.params.orgId)
const projectId = String(route.params.projectId)

const invitationsComposable = useInvitations()
const rolesComposable = useRoles()
const { can, loadPermissions } = usePermissions()

const {
  orgInvitations,
  fetchOrgInvitations,
  isInviteModalVisible,
  inviteUrl,
  openInviteModal,
  closeInviteModal,
  handleInvite,
  handleRevoke,
  handleNewLink,
  closeNewLink,
  isNewLinkVisible,
  newLinkUrl,
} = invitationsComposable
const { roles, fetchRoles } = rolesComposable

const invitationsLoading = computed(() => invitationsComposable.loading.value)

/** Invite payload from InviteFormModal — sending is project-scoped. */
function onInviteSubmit(data: InviteInput): void {
  handleInvite(orgId, data, "project", projectId)
}

function onRevoke(invitationId: string): Promise<void> {
  return handleRevoke(orgId, invitationId)
}

/** Reissues the invitation and copies the new link. The dialog opens only if the copy fails. */
function onResend(invitationId: string): Promise<void> {
  return handleNewLink(orgId, invitationId)
}

onMounted(() => {
  loadPermissions(orgId, authStore.currentUser?.id)
  fetchOrgInvitations(orgId)
  // Roles feed the role dropdown inside InviteFormModal.
  fetchRoles(orgId)
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Invitations" :loading="invitationsLoading && orgInvitations.length > 0">
      <!-- Invite member button — gated by permission -->
      <Button v-if="can('invitations:create')" @click="openInviteModal()">
        <UserPlus /> Invite Member
      </Button>
    </PageHeader>
    <InvitationsTable
      :invitations="orgInvitations"
      :loading="invitationsLoading"
      :can-revoke="can('invitations:manage')"
      :can-resend="can('invitations:manage')"
      :revoke-action="onRevoke"
      @resend="onResend"
    />
    <InviteFormModal
      :open="isInviteModalVisible"
      :roles="roles"
      :loading="invitationsLoading"
      :accept-url="inviteUrl"
      @submit="onInviteSubmit"
      @cancel="closeInviteModal()"
    />
    <InviteLinkDialog :open="isNewLinkVisible" :url="newLinkUrl" @close="closeNewLink()" />
  </div>
</template>
