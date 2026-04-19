/**
 * Invitations API service
 * Handles creating, listing, accepting, declining, and revoking invitations
 * Supports both organization-level and project-level invitations
 */

import { request } from "@/utils/http"

/**
 * Invite a user to an organization
 * @param {string} orgId - Organization UUID
 * @param {Object} data - Invitation data
 * @param {string} data.role_id - Role UUID to assign to the invited user
 * @param {string} [data.username] - Username of the user to invite
 * @param {string} [data.email] - Email of the user to invite
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
 * @param {string} [data.username] - Username of the user to invite
 * @param {string} [data.email] - Email of the user to invite
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
 * @returns {Promise} API response confirming acceptance
 */
export function acceptInvitation(invitationId) {
  return request.post(`/invitations/${invitationId}/accept`)
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
