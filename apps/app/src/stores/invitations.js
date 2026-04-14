/**
 * Invitations store - manages organization and personal invitation state
 */

import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import {
  inviteToOrg as apiInviteToOrg,
  inviteToProject as apiInviteToProject,
  listOrgInvitations as apiListOrgInvitations,
  listMyInvitations as apiListMyInvitations,
  acceptInvitation as apiAcceptInvitation,
  declineInvitation as apiDeclineInvitation,
  revokeInvitation as apiRevokeInvitation,
} from "@/api/invitations"

export const useInvitationsStore = defineStore("invitations", () => {
  // State
  const orgInvitations = ref([])
  const myInvitations = ref([])
  const loading = ref(false)

  // Getters

  /**
   * Count of the current user's pending invitations
   * Used for badge/notification display in the UI
   * @returns {number} Number of invitations with "pending" status
   */
  const pendingCount = computed(() => {
    return myInvitations.value.filter((i) => i.status === "pending").length
  })

  // Actions

  /**
   * Fetch all invitations for an organization (admin view)
   * @param {string} orgId - Organization UUID
   * @returns {Promise<Object>} API response data
   */
  async function fetchOrgInvitations(orgId) {
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
   * @returns {Promise<Object>} API response data
   */
  async function fetchMyInvitations() {
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
   * @param {string} orgId - Organization UUID
   * @param {Object} data - Invitation data
   * @param {string} data.role_id - Role UUID to assign to the invited user
   * @param {string} [data.username] - Username of the user to invite
   * @param {string} [data.email] - Email of the user to invite
   * @returns {Promise<Object>} API response data
   */
  async function inviteToOrg(orgId, data) {
    loading.value = true
    try {
      const response = await apiInviteToOrg(orgId, data)
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
   * @param {string} orgId - Organization UUID that owns the project
   * @param {string} projectId - Project UUID
   * @param {Object} data - Invitation data
   * @param {string} data.role_id - Role UUID to assign to the invited user
   * @param {string} [data.username] - Username of the user to invite
   * @param {string} [data.email] - Email of the user to invite
   * @returns {Promise<Object>} API response data
   */
  async function inviteToProject(orgId, projectId, data) {
    loading.value = true
    try {
      const response = await apiInviteToProject(orgId, projectId, data)
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
   * @param {string} invitationId - Invitation UUID to accept
   * @returns {Promise<Object>} API response data
   */
  async function acceptInvitation(invitationId) {
    loading.value = true
    try {
      const response = await apiAcceptInvitation(invitationId)
      message.success("Invitation accepted!")
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
   * Decline a pending invitation
   * Refreshes the user's invitations list after decline
   * @param {string} invitationId - Invitation UUID to decline
   * @returns {Promise<Object>} API response data
   */
  async function declineInvitation(invitationId) {
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
   * @param {string} orgId - Organization UUID
   * @param {string} invitationId - Invitation UUID to revoke
   * @returns {Promise<Object>} API response data
   */
  async function revokeInvitation(orgId, invitationId) {
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
   * Clear organization invitations state
   * Used when navigating away from an org context to avoid stale data
   */
  function clearOrgInvitations() {
    orgInvitations.value = []
  }

  /**
   * Clear the current user's invitations state
   * Used when logging out to avoid stale data
   */
  function clearMyInvitations() {
    myInvitations.value = []
  }

  return {
    // State
    orgInvitations,
    myInvitations,
    loading,
    // Getters
    pendingCount,
    // Actions
    fetchOrgInvitations,
    fetchMyInvitations,
    inviteToOrg,
    inviteToProject,
    acceptInvitation,
    declineInvitation,
    revokeInvitation,
    clearOrgInvitations,
    clearMyInvitations,
  }
})
