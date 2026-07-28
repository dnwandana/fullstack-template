/**
 * Invitations composable - helpers for invitation operations and invite modal management
 * Manages invite modal state and delegates CRUD actions to the invitations store
 */

import { ref, computed } from "vue"
import type { Envelope, InvitationWithToken, Wire } from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"
import type { MemberScope } from "@/composables/useMembers"
import { useInvitationsStore } from "@/stores/invitations"

export function useInvitations() {
  const invitationsStore = useInvitationsStore()

  // Local state for the invite modal
  const isInviteModalVisible = ref(false)

  /**
   * Open the invite modal
   */
  function openInviteModal(): void {
    isInviteModalVisible.value = true
  }

  /**
   * Close the invite modal
   */
  function closeInviteModal(): void {
    isInviteModalVisible.value = false
  }

  /**
   * Handle sending an invitation at either the org or project scope
   * Delegates to the appropriate store action based on scope, then closes the modal
   */
  async function handleInvite(
    orgId: string,
    data: InviteInput,
    scope: MemberScope,
    projectId?: string,
  ): Promise<void> {
    if (scope === "org") {
      await invitationsStore.inviteToOrg(orgId, data)
    } else if (scope === "project") {
      // `projectId` is optional in the signature but required by this branch. `String()` keeps the
      // missing-id request byte-identical to the JavaScript version rather than skipping the call.
      await invitationsStore.inviteToProject(orgId, String(projectId), data)
    }
    closeInviteModal()
  }

  /**
   * Handle accepting a pending invitation
   * The token comes from the invite link — it is the credential the API checks
   * Resolves to null when acceptance failed, so callers can branch on the outcome
   */
  async function handleAccept(invitationId: string, token: string): Promise<Envelope<null> | null> {
    return invitationsStore.acceptInvitation(invitationId, token)
  }

  /**
   * Handle declining a pending invitation
   */
  async function handleDecline(invitationId: string): Promise<void> {
    await invitationsStore.declineInvitation(invitationId)
  }

  /**
   * Handle revoking an invitation (admin action)
   */
  async function handleRevoke(orgId: string, invitationId: string): Promise<void> {
    await invitationsStore.revokeInvitation(orgId, invitationId)
  }

  /**
   * Handle reissuing an invitation (admin action)
   * Returns the fresh invitation so the caller can surface the new accept link,
   * which is the only place the raw token is ever exposed
   */
  async function handleResend(
    orgId: string,
    invitationId: string,
  ): Promise<Wire<InvitationWithToken> | null> {
    return invitationsStore.resendInvitation(orgId, invitationId)
  }

  return {
    // Store state as computed
    orgInvitations: computed(() => invitationsStore.orgInvitations),
    myInvitations: computed(() => invitationsStore.myInvitations),
    loading: computed(() => invitationsStore.loading),
    pendingCount: computed(() => invitationsStore.pendingCount),
    lastAcceptUrl: computed(() => invitationsStore.lastAcceptUrl),
    // Local modal state
    isInviteModalVisible,
    // Delegated store actions
    fetchOrgInvitations: invitationsStore.fetchOrgInvitations,
    fetchMyInvitations: invitationsStore.fetchMyInvitations,
    previewInvitation: invitationsStore.previewInvitation,
    clearOrgInvitations: invitationsStore.clearOrgInvitations,
    clearMyInvitations: invitationsStore.clearMyInvitations,
    // Composable actions
    openInviteModal,
    closeInviteModal,
    handleInvite,
    handleAccept,
    handleDecline,
    handleRevoke,
    handleResend,
  }
}
