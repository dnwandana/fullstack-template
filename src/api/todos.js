/**
 * Todos API service
 * Handles all CRUD operations for todos
 */

import request from "@/utils/request"

/**
 * Get paginated list of todos
 * @param {Object} params - Query parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=10] - Items per page
 * @param {string} [params.sort_by='updated_at'] - Sort field (updated_at, title)
 * @param {string} [params.sort_order='desc'] - Sort order (asc, desc)
 * @param {string} [params.search=''] - Search term to filter by title (case-insensitive, max 255 chars)
 * @returns {Promise} API response with todos and pagination
 */
export function getTodos(params = {}) {
  return request.get("/todos", { params })
}

/**
 * Get a single todo by ID
 * @param {string} todoId - Todo UUID
 * @returns {Promise} API response with todo data
 */
export function getTodoById(todoId) {
  return request.get(`/todos/${todoId}`)
}

/**
 * Create a new todo
 * @param {Object} data - Todo data
 * @param {string} data.title - Todo title (required)
 * @param {string} [data.description] - Optional description
 * @param {boolean} [data.is_completed] - Completion status
 * @returns {Promise} API response with created todo
 */
export function createTodo(data) {
  return request.post("/todos", data)
}

/**
 * Update an existing todo
 * @param {string} todoId - Todo UUID
 * @param {Object} data - Updated todo data
 * @param {string} data.title - Todo title (required)
 * @param {string} [data.description] - Optional description
 * @param {boolean} [data.is_completed] - Completion status
 * @returns {Promise} API response with updated todo
 */
export function updateTodo(todoId, data) {
  return request.put(`/todos/${todoId}`, data)
}

/**
 * Delete a single todo
 * @param {string} todoId - Todo UUID
 * @returns {Promise} API response
 */
export function deleteTodo(todoId) {
  return request.delete(`/todos/${todoId}`)
}

/**
 * Delete multiple todos
 * @param {string[]} ids - Array of todo UUIDs
 * @returns {Promise} API response
 */
export function deleteTodos(ids) {
  return request.delete("/todos", {
    params: { ids: ids.join(",") },
  })
}
