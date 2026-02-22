/**
 * Roles API service
 * Handles CRUD operations for roles and their permissions within an organization
 * Supports both system-defined and custom roles
 */

import request from "@/utils/request"

/**
 * List all roles in an organization (system + custom)
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response with list of roles
 */
export function getRoles(orgId) {
  return request.get(`/orgs/${orgId}/roles`)
}

/**
 * Get a single role with its assigned permissions
 * @param {string} orgId - Organization UUID
 * @param {string} roleId - Role UUID
 * @returns {Promise} API response with role data including permissions
 */
export function getRole(orgId, roleId) {
  return request.get(`/orgs/${orgId}/roles/${roleId}`)
}

/**
 * Create a new custom role in an organization
 * @param {string} orgId - Organization UUID
 * @param {Object} data - Role data
 * @param {string} data.name - Role name (required)
 * @param {string} [data.description] - Optional role description
 * @param {string[]} data.permissions - Array of permission UUIDs to assign
 * @returns {Promise} API response with created role data
 */
export function createRole(orgId, data) {
  return request.post(`/orgs/${orgId}/roles`, data)
}

/**
 * Update an existing role in an organization
 * @param {string} orgId - Organization UUID
 * @param {string} roleId - Role UUID to update
 * @param {Object} data - Updated role data
 * @param {string} data.name - Role name (required)
 * @param {string} [data.description] - Optional role description
 * @param {string[]} data.permissions - Array of permission UUIDs to assign
 * @returns {Promise} API response with updated role data
 */
export function updateRole(orgId, roleId, data) {
  return request.put(`/orgs/${orgId}/roles/${roleId}`, data)
}

/**
 * Delete a custom role from an organization
 * @param {string} orgId - Organization UUID
 * @param {string} roleId - Role UUID to delete
 * @returns {Promise} API response
 */
export function deleteRole(orgId, roleId) {
  return request.delete(`/orgs/${orgId}/roles/${roleId}`)
}
