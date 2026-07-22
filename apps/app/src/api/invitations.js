/**
 * Invitations API service
 * Handles creating, listing, previewing, accepting, declining, revoking, and
 * resending invitations
 * Supports both organization-level and project-level invitations
 */

import { request } from "@/utils/http"

/**
 * Invite a user to an organization
 * @param {string} orgId - Organization UUID
 * @param {Object} data - Invitation data
 * @param {string} data.role_id - Role UUID to assign to the invited user
 * @param {string} data.email - Email address of the user to invite
 * @returns {Promise} API response with created invitation data
 */
export function inviteToOrg(orgId, data) {
  return request.post(`/orgs/${orgId}/invitations`, data)
}

/**
 * Invite a user to a project within an organization
 * @param {string} orgId - Organization UUID that owns the project
 * @param {string} projectId - Project UUID
 * @param {Object} data - Invitation data
 * @param {string} data.role_id - Role UUID to assign to the invited user
 * @param {string} data.email - Email address of the user to invite
 * @returns {Promise} API response with created invitation data
 */
export function inviteToProject(orgId, projectId, data) {
  return request.post(`/orgs/${orgId}/projects/${projectId}/invitations`, data)
}

/**
 * List all invitations for an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response with list of organization invitations
 */
export function listOrgInvitations(orgId) {
  return request.get(`/orgs/${orgId}/invitations`)
}

/**
 * List all pending invitations for the currently authenticated user
 * @returns {Promise} API response with list of the user's pending invitations
 */
export function listMyInvitations() {
  return request.get("/invitations")
}

/**
 * Accept a pending invitation
 * @param {string} invitationId - Invitation UUID to accept
 * @param {string} token - Raw 64-char hex invitation token from the invite link
 * @returns {Promise} API response confirming acceptance
 */
export function acceptInvitation(invitationId, token) {
  return request.post(`/invitations/${invitationId}/accept`, { token })
}

/**
 * Preview an invitation without being authenticated.
 * Gated by possession of the raw token; returns org/project/inviter context.
 * @param {string} invitationId - Invitation UUID
 * @param {string} token - Raw 64-char hex invitation token
 * @returns {Promise} API response with invitation context
 */
export function previewInvitation(invitationId, token) {
  return request.get(`/invitations/${invitationId}/preview`, { token })
}

/**
 * Decline a pending invitation
 * @param {string} invitationId - Invitation UUID to decline
 * @returns {Promise} API response confirming decline
 */
export function declineInvitation(invitationId) {
  return request.post(`/invitations/${invitationId}/decline`)
}

/**
 * Revoke an invitation from an organization
 * Only organization admins can revoke invitations
 * @param {string} orgId - Organization UUID
 * @param {string} invitationId - Invitation UUID to revoke
 * @returns {Promise} API response
 */
export function revokeInvitation(orgId, invitationId) {
  return request.del(`/orgs/${orgId}/invitations/${invitationId}`)
}

/**
 * Reissue an invitation with a fresh token and expiry
 * Invalidates the previously issued link
 * @param {string} orgId - Organization UUID
 * @param {string} invitationId - Invitation UUID
 * @returns {Promise} API response with the new token and accept_url
 */
export function resendInvitation(orgId, invitationId) {
  return request.post(`/orgs/${orgId}/invitations/${invitationId}/resend`)
}
