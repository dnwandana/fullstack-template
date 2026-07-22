/**
 * Invitations composable - helpers for invitation operations and invite modal management
 * Manages invite modal state and delegates CRUD actions to the invitations store
 */

import { ref, computed } from "vue"
import { useInvitationsStore } from "@/stores/invitations"

export function useInvitations() {
  const invitationsStore = useInvitationsStore()

  // Local state for the invite modal
  const isInviteModalVisible = ref(false)

  /**
   * Open the invite modal
   * @returns {void}
   */
  function openInviteModal() {
    isInviteModalVisible.value = true
  }

  /**
   * Close the invite modal
   * @returns {void}
   */
  function closeInviteModal() {
    isInviteModalVisible.value = false
  }

  /**
   * Handle sending an invitation at either the org or project scope
   * Delegates to the appropriate store action based on scope, then closes the modal
   * @param {string} orgId - Organization UUID
   * @param {Object} data - Invitation data (e.g., { role_id, email })
   * @param {string} scope - Either "org" or "project"
   * @param {string} [projectId] - Project UUID (required when scope is "project")
   * @returns {Promise<void>}
   */
  async function handleInvite(orgId, data, scope, projectId) {
    if (scope === "org") {
      await invitationsStore.inviteToOrg(orgId, data)
    } else if (scope === "project") {
      await invitationsStore.inviteToProject(orgId, projectId, data)
    }
    closeInviteModal()
  }

  /**
   * Handle accepting a pending invitation
   * The token comes from the invite link — it is the credential the API checks
   * @param {string} invitationId - Invitation UUID to accept
   * @param {string} token - Raw invitation token from the invite link
   * @returns {Promise<Object|null>} API response data, or null if acceptance failed
   */
  async function handleAccept(invitationId, token) {
    return invitationsStore.acceptInvitation(invitationId, token)
  }

  /**
   * Handle declining a pending invitation
   * @param {string} invitationId - Invitation UUID to decline
   * @returns {Promise<void>}
   */
  async function handleDecline(invitationId) {
    await invitationsStore.declineInvitation(invitationId)
  }

  /**
   * Handle revoking an invitation (admin action)
   * @param {string} orgId - Organization UUID
   * @param {string} invitationId - Invitation UUID to revoke
   * @returns {Promise<void>}
   */
  async function handleRevoke(orgId, invitationId) {
    await invitationsStore.revokeInvitation(orgId, invitationId)
  }

  /**
   * Handle reissuing an invitation (admin action)
   * Returns the fresh invitation so the caller can surface the new accept link,
   * which is the only place the raw token is ever exposed
   * @param {string} orgId - Organization UUID
   * @param {string} invitationId - Invitation UUID to resend
   * @returns {Promise<Object|null>} Reissued invitation, or null on failure
   */
  async function handleResend(orgId, invitationId) {
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
