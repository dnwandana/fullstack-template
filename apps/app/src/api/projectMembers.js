/**
 * Project Members API service
 * Handles listing, updating roles, and removing members within a project
 * All endpoints are nested under the parent organization and project
 */

import { request } from "@/utils/http"

/**
 * List all members of a project
 * @param {string} orgId - Organization UUID that owns the project
 * @param {string} projectId - Project UUID
 * @returns {Promise} API response with list of project members
 */
export function getProjectMembers(orgId, projectId) {
  return request.get(`/orgs/${orgId}/projects/${projectId}/members`)
}

/**
 * Update the role assigned to a project member
 * @param {string} orgId - Organization UUID that owns the project
 * @param {string} projectId - Project UUID
 * @param {string} userId - User UUID of the member to update
 * @param {string} roleId - New role UUID to assign to the member
 * @returns {Promise} API response with updated member data
 */
export function updateProjectMemberRole(orgId, projectId, userId, roleId) {
  return request.put(`/orgs/${orgId}/projects/${projectId}/members/${userId}`, {
    role_id: roleId,
  })
}

/**
 * Remove a member from a project
 * @param {string} orgId - Organization UUID that owns the project
 * @param {string} projectId - Project UUID
 * @param {string} userId - User UUID of the member to remove
 * @returns {Promise} API response
 */
export function removeProjectMember(orgId, projectId, userId) {
  return request.del(`/orgs/${orgId}/projects/${projectId}/members/${userId}`)
}
