/**
 * Organizations API service
 * Handles CRUD operations for user organizations
 */

import { request } from "@/utils/http"

/**
 * Get list of organizations the current user belongs to
 * @returns {Promise} API response with array of organizations
 */
export function getOrgs() {
  return request.get("/orgs")
}

/**
 * Get a single organization by ID
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response with organization details
 */
export function getOrg(orgId) {
  return request.get(`/orgs/${orgId}`)
}

/**
 * Create a new organization
 * @param {Object} data - Organization data
 * @param {string} data.name - Organization name (required)
 * @param {string} [data.description] - Optional description
 * @returns {Promise} API response with created organization
 */
export function createOrg(data) {
  return request.post("/orgs", data)
}

/**
 * Update an existing organization
 * @param {string} orgId - Organization UUID
 * @param {Object} data - Updated organization data
 * @param {string} data.name - Organization name (required)
 * @param {string} [data.description] - Optional description
 * @returns {Promise} API response with updated organization
 */
export function updateOrg(orgId, data) {
  return request.put(`/orgs/${orgId}`, data)
}

/**
 * Delete an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response
 */
export function deleteOrg(orgId) {
  return request.del(`/orgs/${orgId}`)
}
