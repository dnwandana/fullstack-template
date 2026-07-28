/**
 * Todos store - manages todo state and operations.
 * Supports multi-tenant context via orgId and projectId,
 * which are passed to every API call.
 */

import type { Envelope, PaginatedEnvelope, PaginationMeta, Todo, Wire } from "@fullstack/contracts"
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
  type TodoInput,
  type TodoListParams,
} from "@/api/todos"

export const useTodosStore = defineStore("todos", () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Multi-tenant context — must be set via setContext() before any API call
  const orgId = ref<string | null>(null)
  const projectId = ref<string | null>(null)

  const todos = ref<Wire<Todo>[]>([])
  const currentTodo = ref<Wire<Todo> | null>(null)
  const pagination = ref<PaginationMeta>({
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
  const selectedIds = ref<string[]>([])

  // Sort params
  const sortBy = ref("updated_at")
  const sortOrder = ref("desc")

  // Search params
  const searchQuery = ref("")

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** Whether any todos are currently selected */
  const hasSelected = computed(() => selectedIds.value.length > 0)

  /** The number of currently selected todos */
  const selectedCount = computed(() => selectedIds.value.length)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Read the multi-tenant context for an API call. The refs are null until `setContext` runs;
   * `String()` reproduces exactly what the JavaScript version sent in that case — a literal
   * `/orgs/null/...` URL — rather than silently changing the failure mode to an empty segment.
   */
  function ctx(): { org: string; project: string } {
    return { org: String(orgId.value), project: String(projectId.value) }
  }

  /**
   * Set the multi-tenant context for all todo operations.
   * This must be called before performing any API-based action so that
   * requests are scoped to the correct organisation and project.
   */
  function setContext(org: string, project: string): void {
    orgId.value = org
    projectId.value = project
  }

  /**
   * Fetch a paginated list of todos from the API.
   * Falls back to the current pagination / sort / search state when
   * individual params are not provided.
   */
  async function fetchTodos(params: TodoListParams = {}): Promise<PaginatedEnvelope<Wire<Todo>[]>> {
    loading.value = true
    try {
      // Build the query object, merging explicit params with stored defaults
      const query: TodoListParams = {
        page: params.page || pagination.value.current_page,
        limit: params.limit || pagination.value.items_per_page,
        sort_by: params.sort_by || sortBy.value,
        sort_order: params.sort_order || sortOrder.value,
      }

      // Only include search param when a query string is present
      if (searchQuery.value) {
        query.search = searchQuery.value
      }

      const { org, project } = ctx()
      const response = await apiGetTodos(org, project, query)

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
   */
  async function fetchTodoById(todoId: string): Promise<Envelope<Wire<Todo>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiGetTodoById(org, project, todoId)
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
   */
  async function createTodo(data: TodoInput): Promise<Envelope<Wire<Todo>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiCreateTodo(org, project, data)
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
   */
  async function updateTodo(todoId: string, data: TodoInput): Promise<Envelope<Wire<Todo>>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiUpdateTodo(org, project, todoId, data)
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
   */
  async function deleteTodo(todoId: string): Promise<Envelope<null>> {
    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiDeleteTodo(org, project, todoId)
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
   * Uses the provided IDs array, or falls back to the current selection when
   * `ids` is null. Resolves to undefined when there was nothing to delete.
   */
  async function bulkDelete(ids: string[] | null = null): Promise<Envelope<null> | undefined> {
    const idsToDelete = ids || selectedIds.value
    if (idsToDelete.length === 0) {
      return
    }

    loading.value = true
    try {
      const { org, project } = ctx()
      const response = await apiDeleteTodos(org, project, idsToDelete)
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
   */
  function toggleSelection(todoId: string): void {
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
   */
  function selectAll(): void {
    selectedIds.value = todos.value.map((todo) => todo.id)
  }

  /**
   * Clear all todo selections.
   */
  function clearSelection(): void {
    selectedIds.value = []
  }

  /**
   * Set the sort field and order used when fetching todos.
   */
  function setSort(field: string, order: string): void {
    sortBy.value = field
    sortOrder.value = order
  }

  /**
   * Set the search query used to filter todos.
   */
  function setSearch(query: string): void {
    searchQuery.value = query
  }

  /**
   * Clear the currently viewed single todo.
   */
  function clearCurrentTodo(): void {
    currentTodo.value = null
  }

  /**
   * Reset all store state back to its initial defaults.
   * Used when navigating away from a project context so that
   * stale data from a previous org/project is not visible.
   */
  function clearAll(): void {
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
