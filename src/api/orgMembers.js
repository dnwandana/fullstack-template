/**
 * Organization Members API service
 * Handles listing, updating roles, and removing members within an organization
 */

import request from "@/utils/request"

/**
 * List all members of an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response with list of organization members
 */
export function getOrgMembers(orgId) {
  return request.get(`/orgs/${orgId}/members`)
}

/**
 * Update the role assigned to an organization member
 * @param {string} orgId - Organization UUID
 * @param {string} userId - User UUID of the member to update
 * @param {string} roleId - New role UUID to assign to the member
 * @returns {Promise} API response with updated member data
 */
export function updateOrgMemberRole(orgId, userId, roleId) {
  return request.put(`/orgs/${orgId}/members/${userId}`, { role_id: roleId })
}

/**
 * Remove a member from an organization
 * @param {string} orgId - Organization UUID
 * @param {string} userId - User UUID of the member to remove
 * @returns {Promise} API response
 */
export function removeOrgMember(orgId, userId) {
  return request.delete(`/orgs/${orgId}/members/${userId}`)
}
