/**
 * Todos composable - helpers for todo operations
 */

import { ref, computed } from "vue"
import { useTodosStore } from "@/stores/todos"

export function useTodos() {
  const todosStore = useTodosStore()

  // Modal state
  const isModalVisible = ref(false)
  const editingTodo = ref(null)

  // Validation rules for todo form
  const titleRules = [
    { required: true, message: "Please enter a title" },
    { max: 255, message: "Title cannot exceed 255 characters" },
  ]

  // Computed
  const isEditing = computed(() => !!editingTodo.value)

  /**
   * Open modal for creating a new todo
   */
  function openCreateModal() {
    editingTodo.value = null
    isModalVisible.value = true
  }

  /**
   * Open modal for editing an existing todo
   * @param {Object} todo - Todo to edit
   */
  function openEditModal(todo) {
    editingTodo.value = { ...todo }
    isModalVisible.value = true
  }

  /**
   * Close the modal
   */
  function closeModal() {
    isModalVisible.value = false
    editingTodo.value = null
  }

  /**
   * Handle form submission (create or update)
   * @param {Object} formData - Form data
   */
  async function handleSubmit(formData) {
    if (isEditing.value) {
      await todosStore.updateTodo(editingTodo.value.id, formData)
    } else {
      await todosStore.createTodo(formData)
    }
    closeModal()
  }

  /**
   * Handle page change
   * @param {number} page - New page number
   */
  function handlePageChange(page) {
    todosStore.fetchTodos({ page })
  }

  /**
   * Handle page size change
   * @param {number} current - Current page
   * @param {number} size - New page size
   */
  function handlePageSizeChange(current, size) {
    todosStore.fetchTodos({ page: 1, limit: size })
  }

  /**
   * Handle sort change
   * @param {string} field - Sort field
   * @param {string} order - Sort order
   */
  function handleSortChange(field, order) {
    todosStore.setSort(field, order)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle search
   * @param {string} value - Search query
   */
  function handleSearch(value) {
    todosStore.setSearch(value)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle row selection change
   * @param {string[]} selectedRowKeys - Selected row keys
   */
  function handleSelectionChange(selectedRowKeys) {
    todosStore.selectedIds = selectedRowKeys
  }

  /**
   * Check if a todo is selected
   * @param {string} todoId - Todo ID
   * @returns {boolean}
   */
  function isSelected(todoId) {
    return todosStore.selectedIds.includes(todoId)
  }

  return {
    // Store state (exposed for convenience)
    todos: computed(() => todosStore.todos),
    pagination: computed(() => todosStore.pagination),
    loading: computed(() => todosStore.loading),
    selectedIds: computed(() => todosStore.selectedIds),
    hasSelected: computed(() => todosStore.hasSelected),
    selectedCount: computed(() => todosStore.selectedCount),
    sortBy: computed(() => todosStore.sortBy),
    sortOrder: computed(() => todosStore.sortOrder),
    searchQuery: computed(() => todosStore.searchQuery),
    currentTodo: computed(() => todosStore.currentTodo),
    // Modal state
    isModalVisible,
    editingTodo,
    isEditing,
    // Validation rules
    titleRules,
    // Actions
    fetchTodos: todosStore.fetchTodos,
    fetchTodoById: todosStore.fetchTodoById,
    deleteTodo: todosStore.deleteTodo,
    bulkDelete: todosStore.bulkDelete,
    clearCurrentTodo: todosStore.clearCurrentTodo,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handlePageChange,
    handlePageSizeChange,
    handleSortChange,
    handleSearch,
    handleSelectionChange,
    isSelected,
  }
}
