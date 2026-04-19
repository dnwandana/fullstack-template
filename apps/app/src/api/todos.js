/**
 * Todos API service
 * Handles all CRUD operations for todos within a project (multi-tenant)
 * All endpoints are scoped under /orgs/{orgId}/projects/{projectId}/todos
 */

import { request } from "@/utils/http"

/**
 * Build the base URL for todos scoped to an organization and project
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @returns {string} Base URL path for todos
 */
function basePath(orgId, projectId) {
  return `/orgs/${orgId}/projects/${projectId}/todos`
}

/**
 * Get paginated list of todos for a project
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {Object} params - Query parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=10] - Items per page
 * @param {string} [params.sort_by='updated_at'] - Sort field (updated_at, title)
 * @param {string} [params.sort_order='desc'] - Sort order (asc, desc)
 * @param {string} [params.search=''] - Search term to filter by title (case-insensitive, max 255 chars)
 * @returns {Promise} API response with todos and pagination
 */
export function getTodos(orgId, projectId, params = {}) {
  return request.get(basePath(orgId, projectId), params)
}

/**
 * Get a single todo by ID
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {string} todoId - Todo UUID
 * @returns {Promise} API response with todo data
 */
export function getTodoById(orgId, projectId, todoId) {
  return request.get(`${basePath(orgId, projectId)}/${todoId}`)
}

/**
 * Create a new todo within a project
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {Object} data - Todo data
 * @param {string} data.title - Todo title (required)
 * @param {string} [data.description] - Optional description
 * @param {boolean} [data.is_completed] - Completion status
 * @returns {Promise} API response with created todo
 */
export function createTodo(orgId, projectId, data) {
  return request.post(basePath(orgId, projectId), data)
}

/**
 * Update an existing todo
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {string} todoId - Todo UUID
 * @param {Object} data - Updated todo data
 * @param {string} data.title - Todo title (required)
 * @param {string} [data.description] - Optional description
 * @param {boolean} [data.is_completed] - Completion status
 * @returns {Promise} API response with updated todo
 */
export function updateTodo(orgId, projectId, todoId, data) {
  return request.put(`${basePath(orgId, projectId)}/${todoId}`, data)
}

/**
 * Delete a single todo
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {string} todoId - Todo UUID
 * @returns {Promise} API response
 */
export function deleteTodo(orgId, projectId, todoId) {
  return request.del(`${basePath(orgId, projectId)}/${todoId}`)
}

/**
 * Delete multiple todos
 * @param {string} orgId - Organization UUID
 * @param {string} projectId - Project UUID
 * @param {string[]} ids - Array of todo UUIDs
 * @returns {Promise} API response
 */
export function deleteTodos(orgId, projectId, ids) {
  return request.del(basePath(orgId, projectId), { ids: ids.join(",") })
}
