/**
 * Projects API service
 * Handles CRUD operations for projects within an organization
 */

import { request } from "@/utils/http"

/**
 * Get list of projects for an organization
 * @param {string} orgId - Organization UUID
 * @returns {Promise} API response with array of projects
 */
export function getProjects(orgId) {
  return request.get(`/orgs/${orgId}/projects`)
}

/**
 * Get a single project by ID
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @returns {Promise} API response with project details
 */
export function getProject(orgId, projectId) {
  return request.get(`/orgs/${orgId}/projects/${projectId}`)
}

/**
 * Create a new project within an organization
 * @param {string} orgId - Organization UUID
 * @param {Object} data - Project data
 * @param {string} data.name - Project name (required)
 * @param {string} [data.description] - Optional description
 * @returns {Promise} API response with created project
 */
export function createProject(orgId, data) {
  return request.post(`/orgs/${orgId}/projects`, data)
}

/**
 * Update an existing project
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {Object} data - Updated project data
 * @param {string} data.name - Project name (required)
 * @param {string} [data.description] - Optional description
 * @returns {Promise} API response with updated project
 */
export function updateProject(orgId, projectId, data) {
  return request.put(`/orgs/${orgId}/projects/${projectId}`, data)
}

/**
 * Delete a project
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @returns {Promise} API response
 */
export function deleteProject(orgId, projectId) {
  return request.del(`/orgs/${orgId}/projects/${projectId}`)
}