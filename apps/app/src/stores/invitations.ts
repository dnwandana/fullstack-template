/**
 * Invitations store - manages organization and personal invitation state
 */

import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import type {
  Envelope,
  InvitationListItem,
  InvitationPreview,
  InvitationWithToken,
  MyInvitation,
  PaginatedEnvelope,
  Wire,
} from "@fullstack/contracts"
import type { InviteInput } from "@/api/invitations"
import {
  inviteToOrg as apiInviteToOrg,
  inviteToProject as apiInviteToProject,
  listOrgInvitations as apiListOrgInvitations,
  listMyInvitations as apiListMyInvitations,
  acceptInvitation as apiAcceptInvitation,
  previewInvitation as apiPreviewInvitation,
  declineInvitation as apiDeclineInvitation,
  revokeInvitation as apiRevokeInvitation,
  resendInvitation as apiResendInvitation,
} from "@/api/invitations"

export const useInvitationsStore = defineStore("invitations", () => {
  // State
  const orgInvitations = ref<Wire<InvitationListItem>[]>([])
  const myInvitations = ref<Wire<MyInvitation>[]>([])
  const loading = ref(false)
  // Accept URL of the most recently issued invitation link. The template ships
  // no mail provider, so the admin is the delivery mechanism — this keeps the
  // freshly minted link available to the UI right after inviting.
  const lastAcceptUrl = ref<string | null>(null)

  // Getters

  /**
   * Count of the current user's pending invitations
   * Used for badge/notification display in the UI
   */
  const pendingCount = computed(() => {
    return myInvitations.value.filter((i) => i.status === "pending").length
  })

  // Actions

  /**
   * Fetch all invitations for an organization (admin view)
   */
  async function fetchOrgInvitations(
    orgId: string,
  ): Promise<PaginatedEnvelope<Wire<InvitationListItem>[]> | undefined> {
    loading.value = true
    try {
      const response = await apiListOrgInvitations(orgId)
      orgInvitations.value = response.data.data
      return response.data
    } catch {
      orgInvitations.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all pending invitations for the currently authenticated user
   */
  async function fetchMyInvitations(): Promise<Envelope<Wire<MyInvitation>[]> | undefined> {
    loading.value = true
    try {
      const response = await apiListMyInvitations()
      myInvitations.value = response.data.data
      return response.data
    } catch {
      myInvitations.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Invite a user to an organization
   * Refreshes the org invitations list after a successful invite
   */
  async function inviteToOrg(
    orgId: string,
    data: InviteInput,
  ): Promise<Envelope<Wire<InvitationWithToken>> | undefined> {
    loading.value = true
    try {
      const response = await apiInviteToOrg(orgId, data)
      lastAcceptUrl.value = response.data.data?.accept_url ?? null
      message.success("Invitation sent successfully!")
      // Refresh the org invitations list to include the new invitation
      await fetchOrgInvitations(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Invite a user to a project within an organization
   * Refreshes the org invitations list after a successful invite
   */
  async function inviteToProject(
    orgId: string,
    projectId: string,
    data: InviteInput,
  ): Promise<Envelope<Wire<InvitationWithToken>> | undefined> {
    loading.value = true
    try {
      const response = await apiInviteToProject(orgId, projectId, data)
      lastAcceptUrl.value = response.data.data?.accept_url ?? null
      message.success("Invitation sent successfully!")
      // Refresh org invitations since project invitations appear there too
      await fetchOrgInvitations(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Accept a pending invitation
   * Refreshes the user's invitations list after acceptance
   */
  async function acceptInvitation(
    invitationId: string,
    token: string,
  ): Promise<Envelope<null> | null> {
    loading.value = true
    try {
      const response = await apiAcceptInvitation(invitationId, token)
      message.success("Invitation accepted!")
      // Refresh the user's invitations to update the status
      await fetchMyInvitations()
      return response.data
    } catch {
      // Error toast is raised by the http layer. Return null rather than
      // undefined so callers can branch on the outcome — an invitation can be
      // revoked or accepted elsewhere between preview and click, and the caller
      // must not treat that failure as success.
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch public context for an invitation link (works logged out)
   * Returns null rather than throwing so callers can render an "invalid link"
   * state without distinguishing a bad token from a missing invitation
   */
  async function previewInvitation(
    invitationId: string,
    token: string,
  ): Promise<Wire<InvitationPreview> | null> {
    loading.value = true
    try {
      const response = await apiPreviewInvitation(invitationId, token)
      return response.data.data
    } catch {
      // Error toast is raised by the http layer
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Decline a pending invitation
   * Refreshes the user's invitations list after decline
   */
  async function declineInvitation(invitationId: string): Promise<Envelope<null> | undefined> {
    loading.value = true
    try {
      const response = await apiDeclineInvitation(invitationId)
      message.success("Invitation declined")
      // Refresh the user's invitations to update the status
      await fetchMyInvitations()
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Revoke an invitation from an organization (admin action)
   * Refreshes the org invitations list after revocation
   */
  async function revokeInvitation(
    orgId: string,
    invitationId: string,
  ): Promise<Envelope<null> | undefined> {
    loading.value = true
    try {
      const response = await apiRevokeInvitation(orgId, invitationId)
      message.success("Invitation revoked")
      // Refresh the org invitations list to remove the revoked invitation
      await fetchOrgInvitations(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Reissue an invitation, returning a fresh accept link
   * The previously issued link stops working
   */
  async function resendInvitation(
    orgId: string,
    invitationId: string,
  ): Promise<Wire<InvitationWithToken> | null> {
    loading.value = true
    try {
      const response = await apiResendInvitation(orgId, invitationId)
      lastAcceptUrl.value = response.data.data?.accept_url ?? null
      message.success("New invitation link generated")
      // Refresh the org invitations list to pick up the new expiry
      await fetchOrgInvitations(orgId)
      return response.data.data
    } catch {
      // Error toast is raised by the http layer
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear organization invitations state
   * Used when navigating away from an org context to avoid stale data
   */
  function clearOrgInvitations(): void {
    orgInvitations.value = []
  }

  /**
   * Clear the current user's invitations state
   * Used when logging out to avoid stale data
   */
  function clearMyInvitations(): void {
    myInvitations.value = []
  }

  return {
    // State
    orgInvitations,
    myInvitations,
    loading,
    lastAcceptUrl,
    // Getters
    pendingCount,
    // Actions
    fetchOrgInvitations,
    fetchMyInvitations,
    inviteToOrg,
    inviteToProject,
    acceptInvitation,
    previewInvitation,
    declineInvitation,
    revokeInvitation,
    resendInvitation,
    clearOrgInvitations,
    clearMyInvitations,
  }
})
