/**
 * Invitations composable - helpers for invitation operations and invite modal management
 * Manages invite modal state and delegates CRUD actions to the invitations store
 */

import { ref, computed } from "vue"
import type { Envelope, InvitationWithToken, Wire } from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"
import type { MemberScope } from "@/composables/useMembers"
import { useInvitationsStore } from "@/stores/invitations"
import { copyInviteLink } from "@/utils/clipboard"

export function useInvitations() {
  const invitationsStore = useInvitationsStore()

  // Local state for the invite modal
  const isInviteModalVisible = ref(false)
  // The accept URL of the last invite. The API returns it once, so only the open modal holds it.
  const inviteUrl = ref<string | null>(null)
  // The "New link" fallback. The link stays set after close, so it does not vanish in the fade-out.
  const isNewLinkVisible = ref(false)
  const newLinkUrl = ref<string | null>(null)

  /**
   * Open the invite modal
   */
  function openInviteModal(): void {
    inviteUrl.value = null
    isInviteModalVisible.value = true
  }

  /**
   * Close the invite modal
   */
  function closeInviteModal(): void {
    isInviteModalVisible.value = false
  }

  /**
   * Sends an invitation at the org or the project scope. The modal stays open and shows the link.
   * Returns the accept URL, or null when the request fails.
   */
  async function handleInvite(
    orgId: string,
    data: InviteInput,
    scope: MemberScope,
    projectId?: string,
  ): Promise<string | null> {
    // `projectId` is optional in the signature but required by the project branch. `String()` keeps
    // the missing-id request byte-identical to the JavaScript version rather than skipping the call.
    const url =
      scope === "org"
        ? await invitationsStore.inviteToOrg(orgId, data)
        : await invitationsStore.inviteToProject(orgId, String(projectId), data)
    inviteUrl.value = url
    return url
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

  /**
   * Reissues an invitation and copies the new link. Opens the link dialog when the copy fails.
   * The API returns the raw token only once, so the link must stay visible until the admin copies it.
   */
  async function handleNewLink(orgId: string, invitationId: string): Promise<void> {
    const result = await handleResend(orgId, invitationId)
    if (!result) return
    if (await copyInviteLink(result.accept_url)) return
    newLinkUrl.value = result.accept_url
    isNewLinkVisible.value = true
  }

  /** Closes the link dialog. */
  function closeNewLink(): void {
    isNewLinkVisible.value = false
  }

  return {
    // Store state as computed
    orgInvitations: computed(() => invitationsStore.orgInvitations),
    myInvitations: computed(() => invitationsStore.myInvitations),
    loading: computed(() => invitationsStore.loading),
    pendingCount: computed(() => invitationsStore.pendingCount),
    // Local modal state
    isInviteModalVisible,
    inviteUrl,
    isNewLinkVisible,
    newLinkUrl,
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
    closeNewLink,
    handleNewLink,
  }
}
