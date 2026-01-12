/**
 * Todos store - manages todo state and operations
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  getTodos as apiGetTodos,
  getTodoById as apiGetTodoById,
  createTodo as apiCreateTodo,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
  deleteTodos as apiDeleteTodos,
} from '@/api/todos'

export const useTodosStore = defineStore('todos', () => {
  // State
  const todos = ref([])
  const currentTodo = ref(null)
  const pagination = ref({
    current_page: 1,
    total_pages: 0,
    total_items: 0,
    items_per_page: 10,
    has_next_page: false,
    has_previous_page: false,
  })
  const loading = ref(false)
  const selectedIds = ref([])

  // Sort params
  const sortBy = ref('updated_at')
  const sortOrder = ref('desc')

  // Getters
  const hasSelected = computed(() => selectedIds.value.length > 0)
  const selectedCount = computed(() => selectedIds.value.length)

  // Actions

  /**
   * Fetch paginated todos list
   * @param {Object} params - Query parameters
   */
  async function fetchTodos(params = {}) {
    loading.value = true
    try {
      const response = await apiGetTodos({
        page: params.page || pagination.value.current_page,
        limit: params.limit || pagination.value.items_per_page,
        sort_by: params.sort_by || sortBy.value,
        sort_order: params.sort_order || sortOrder.value,
      })

      todos.value = response.data.data.todos
      pagination.value = response.data.data.pagination

      // Update sort params if provided
      if (params.sort_by) sortBy.value = params.sort_by
      if (params.sort_order) sortOrder.value = params.sort_order

      return response.data
    } catch (error) {
      todos.value = []
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single todo by ID
   * @param {string} todoId
   */
  async function fetchTodoById(todoId) {
    loading.value = true
    try {
      const response = await apiGetTodoById(todoId)
      currentTodo.value = response.data.data.todo
      return response.data
    } catch (error) {
      currentTodo.value = null
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new todo
   * @param {Object} data - Todo data
   */
  async function createTodo(data) {
    loading.value = true
    try {
      const response = await apiCreateTodo(data)
      message.success('Todo created successfully!')
      // Refresh the list
      await fetchTodos()
      return response.data
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing todo
   * @param {string} todoId
   * @param {Object} data - Updated todo data
   */
  async function updateTodo(todoId, data) {
    loading.value = true
    try {
      const response = await apiUpdateTodo(todoId, data)
      message.success('Todo updated successfully!')
      // Refresh the list
      await fetchTodos()
      return response.data
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a single todo
   * @param {string} todoId
   */
  async function deleteTodo(todoId) {
    loading.value = true
    try {
      const response = await apiDeleteTodo(todoId)
      message.success('Todo deleted successfully!')
      // Refresh the list
      await fetchTodos()
      return response.data
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete multiple todos
   * @param {string[]} ids - Array of todo IDs
   */
  async function bulkDelete(ids = null) {
    const idsToDelete = ids || selectedIds.value
    if (idsToDelete.length === 0) return

    loading.value = true
    try {
      const response = await apiDeleteTodos(idsToDelete)
      message.success(`${idsToDelete.length} todo(s) deleted successfully!`)
      // Clear selection and refresh
      selectedIds.value = []
      await fetchTodos()
      return response.data
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Toggle selection of a todo
   * @param {string} todoId
   */
  function toggleSelection(todoId) {
    const index = selectedIds.value.indexOf(todoId)
    if (index === -1) {
      selectedIds.value.push(todoId)
    } else {
      selectedIds.value.splice(index, 1)
    }
  }

  /**
   * Select all todos on current page
   */
  function selectAll() {
    selectedIds.value = todos.value.map((todo) => todo.id)
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    selectedIds.value = []
  }

  /**
   * Set sort parameters
   * @param {string} field - Sort field
   * @param {string} order - Sort order
   */
  function setSort(field, order) {
    sortBy.value = field
    sortOrder.value = order
  }

  /**
   * Clear current todo
   */
  function clearCurrentTodo() {
    currentTodo.value = null
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
    // Getters
    hasSelected,
    selectedCount,
    // Actions
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
    clearCurrentTodo,
  }
})
