/**
 * Todos store - manages todo state and operations.
 * Supports multi-tenant context via orgId and projectId,
 * which are passed to every API call.
 */

import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import {
  getTodos as apiGetTodos,
  getTodoById as apiGetTodoById,
  createTodo as apiCreateTodo,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
  deleteTodos as apiDeleteTodos,
} from "@/api/todos"

export const useTodosStore = defineStore("todos", () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Multi-tenant context — must be set via setContext() before any API call
  const orgId = ref(null)
  const projectId = ref(null)

  const todos = ref([])
  const currentTodo = ref(null)
  const pagination = ref({
    current_page: 1,
    total_pages: 0,
    total_items: 0,
    items_per_page: 10,
    has_next_page: false,
    has_previous_page: false,
    next_page: null,
    previous_page: null,
  })
  const loading = ref(false)
  const selectedIds = ref([])

  // Sort params
  const sortBy = ref("updated_at")
  const sortOrder = ref("desc")

  // Search params
  const searchQuery = ref("")

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** @returns {boolean} Whether any todos are currently selected */
  const hasSelected = computed(() => selectedIds.value.length > 0)

  /** @returns {number} The number of currently selected todos */
  const selectedCount = computed(() => selectedIds.value.length)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Set the multi-tenant context for all todo operations.
   * This must be called before performing any API-based action so that
   * requests are scoped to the correct organisation and project.
   * @param {string} org - Organisation UUID
   * @param {string} project - Project UUID
   * @returns {void}
   */
  function setContext(org, project) {
    orgId.value = org
    projectId.value = project
  }

  /**
   * Fetch a paginated list of todos from the API.
   * Falls back to the current pagination / sort / search state when
   * individual params are not provided.
   * @param {Object} [params={}] - Optional query parameter overrides
   * @param {number} [params.page] - Page number to fetch
   * @param {number} [params.limit] - Number of items per page
   * @param {string} [params.sort_by] - Field name to sort by
   * @param {string} [params.sort_order] - Sort direction ("asc" or "desc")
   * @returns {Promise<Object>} The API response data
   */
  async function fetchTodos(params = {}) {
    loading.value = true
    try {
      // Build the query object, merging explicit params with stored defaults
      const query = {
        page: params.page || pagination.value.current_page,
        limit: params.limit || pagination.value.items_per_page,
        sort_by: params.sort_by || sortBy.value,
        sort_order: params.sort_order || sortOrder.value,
      }

      // Only include search param when a query string is present
      if (searchQuery.value) {
        query.search = searchQuery.value
      }

      const response = await apiGetTodos(orgId.value, projectId.value, query)

      todos.value = response.data.data
      pagination.value = response.data.pagination

      // Persist new sort params so subsequent fetches stay consistent
      if (params.sort_by) {
        sortBy.value = params.sort_by
      }
      if (params.sort_order) {
        sortOrder.value = params.sort_order
      }

      return response.data
    } catch (error) {
      // Clear the list so the UI does not show stale data after an error
      todos.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single todo by its ID.
   * The result is stored in `currentTodo` for detail views.
   * @param {string} todoId - UUID of the todo to fetch
   * @returns {Promise<Object>} The API response data
   */
  async function fetchTodoById(todoId) {
    loading.value = true
    try {
      const response = await apiGetTodoById(orgId.value, projectId.value, todoId)
      currentTodo.value = response.data.data
      return response.data
    } catch (error) {
      // Clear currentTodo so the UI does not render a stale record
      currentTodo.value = null
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new todo and refresh the list.
   * @param {Object} data - Todo payload (title, description, etc.)
   * @returns {Promise<Object>} The API response data for the created todo
   */
  async function createTodo(data) {
    loading.value = true
    try {
      const response = await apiCreateTodo(orgId.value, projectId.value, data)
      message.success("Todo created successfully!")
      // Refresh the list so the new item appears immediately
      await fetchTodos()
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing todo and refresh the list.
   * @param {string} todoId - UUID of the todo to update
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} The API response data for the updated todo
   */
  async function updateTodo(todoId, data) {
    loading.value = true
    try {
      const response = await apiUpdateTodo(orgId.value, projectId.value, todoId, data)
      message.success("Todo updated successfully!")
      // Refresh the list to reflect the changes
      await fetchTodos()
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a single todo by ID and refresh the list.
   * @param {string} todoId - UUID of the todo to delete
   * @returns {Promise<Object>} The API response data
   */
  async function deleteTodo(todoId) {
    loading.value = true
    try {
      const response = await apiDeleteTodo(orgId.value, projectId.value, todoId)
      message.success("Todo deleted successfully!")
      // Refresh the list to remove the deleted item
      await fetchTodos()
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete multiple todos in a single request.
   * Uses the provided IDs array, or falls back to the current selection.
   * @param {string[]|null} [ids=null] - Array of todo UUIDs to delete.
   *   When null, the current `selectedIds` are used.
   * @returns {Promise<Object|undefined>} The API response data, or undefined
   *   if there was nothing to delete
   */
  async function bulkDelete(ids = null) {
    const idsToDelete = ids || selectedIds.value
    if (idsToDelete.length === 0) {
      return
    }

    loading.value = true
    try {
      const response = await apiDeleteTodos(orgId.value, projectId.value, idsToDelete)
      message.success(`${idsToDelete.length} todo(s) deleted successfully!`)
      // Clear selection and refresh the list
      selectedIds.value = []
      await fetchTodos()
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Toggle the selection state of a single todo.
   * If the todo is already selected it will be deselected, and vice versa.
   * @param {string} todoId - UUID of the todo to toggle
   * @returns {void}
   */
  function toggleSelection(todoId) {
    const index = selectedIds.value.indexOf(todoId)
    if (index === -1) {
      // Not currently selected — add it
      selectedIds.value.push(todoId)
    } else {
      // Already selected — remove it
      selectedIds.value.splice(index, 1)
    }
  }

  /**
   * Select all todos on the current page.
   * @returns {void}
   */
  function selectAll() {
    selectedIds.value = todos.value.map((todo) => todo.id)
  }

  /**
   * Clear all todo selections.
   * @returns {void}
   */
  function clearSelection() {
    selectedIds.value = []
  }

  /**
   * Set the sort field and order used when fetching todos.
   * @param {string} field - The field name to sort by (e.g. "updated_at")
   * @param {string} order - Sort direction ("asc" or "desc")
   * @returns {void}
   */
  function setSort(field, order) {
    sortBy.value = field
    sortOrder.value = order
  }

  /**
   * Set the search query used to filter todos.
   * @param {string} query - Search term to filter by title
   * @returns {void}
   */
  function setSearch(query) {
    searchQuery.value = query
  }

  /**
   * Clear the currently viewed single todo.
   * @returns {void}
   */
  function clearCurrentTodo() {
    currentTodo.value = null
  }

  /**
   * Reset all store state back to its initial defaults.
   * Used when navigating away from a project context so that
   * stale data from a previous org/project is not visible.
   * @returns {void}
   */
  function clearAll() {
    todos.value = []
    currentTodo.value = null
    pagination.value = {
      current_page: 1,
      total_pages: 0,
      total_items: 0,
      items_per_page: 10,
      has_next_page: false,
      has_previous_page: false,
      next_page: null,
      previous_page: null,
    }
    loading.value = false
    selectedIds.value = []
    sortBy.value = "updated_at"
    sortOrder.value = "desc"
    searchQuery.value = ""
    orgId.value = null
    projectId.value = null
  }

  return {
    // State
    todos,
    currentTodo,
    pagination,
    loading,
    selectedIds,
    sortBy,
    sortOrder,
    searchQuery,
    orgId,
    projectId,
    // Getters
    hasSelected,
    selectedCount,
    // Actions
    setContext,
    fetchTodos,
    fetchTodoById,
    createTodo,
    updateTodo,
    deleteTodo,
    bulkDelete,
    toggleSelection,
    selectAll,
    clearSelection,
    setSort,
    setSearch,
    clearCurrentTodo,
    clearAll,
  }
})
