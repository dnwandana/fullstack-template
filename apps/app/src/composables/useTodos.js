/**
 * Todos composable - helpers for todo operations.
 * Bridges the todos store and UI components by providing modal state,
 * validation rules, and convenience wrappers around store actions.
 * Supports multi-tenant context via orgId and projectId.
 */

import { ref, computed } from "vue"
import { useTodosStore } from "@/stores/todos"

/**
 * Composable for managing todo CRUD operations, modal UI state,
 * pagination, sorting, searching, and multi-tenant context.
 * @returns {Object} Reactive state, computed properties, validation rules, and actions
 */
export function useTodos() {
  const todosStore = useTodosStore()

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------

  /** @type {import('vue').Ref<boolean>} Whether the create/edit modal is visible */
  const isModalVisible = ref(false)

  /** @type {import('vue').Ref<Object|null>} The todo being edited, or null for create mode */
  const editingTodo = ref(null)

  // ---------------------------------------------------------------------------
  // Validation rules
  // ---------------------------------------------------------------------------

  /** Ant Design form validation rules for the todo title field */
  const titleRules = [
    { required: true, message: "Please enter a title" },
    { max: 255, message: "Title cannot exceed 255 characters" },
  ]

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  /**
   * Whether the modal is in edit mode (as opposed to create mode).
   * Determined by checking if a todo is loaded for editing.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const isEditing = computed(() => !!editingTodo.value)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Set the multi-tenant context for todo operations.
   * Must be called before performing any API-based action so that
   * requests are scoped to the correct organization and project.
   * @param {string} orgId - Organization UUID
   * @param {string} projectId - Project UUID
   */
  function setContext(orgId, projectId) {
    todosStore.setContext(orgId, projectId)
  }

  /**
   * Clear all todo state and context.
   * Resets the store to its initial defaults, including the multi-tenant
   * context, pagination, sort, search, and selection state.
   */
  function clearAll() {
    todosStore.clearAll()
  }

  /**
   * Open the modal in create mode.
   * Resets editingTodo so the form starts empty.
   */
  function openCreateModal() {
    editingTodo.value = null
    isModalVisible.value = true
  }

  /**
   * Open the modal in edit mode with a shallow clone of the given todo.
   * Cloning prevents the form from mutating the store state directly.
   * @param {Object} todo - The todo object to edit
   */
  function openEditModal(todo) {
    editingTodo.value = { ...todo }
    isModalVisible.value = true
  }

  /**
   * Close the modal and reset the editing state.
   */
  function closeModal() {
    isModalVisible.value = false
    editingTodo.value = null
  }

  /**
   * Handle form submission for both create and update operations.
   * Delegates to the appropriate store action based on whether we are editing
   * an existing todo or creating a new one, then closes the modal.
   * @param {Object} formData - The form data to submit
   * @param {string} formData.title - Todo title (required)
   * @param {string} [formData.description] - Optional description
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
   * Handle page or page size change by fetching the requested page.
   * @param {number} page - New page number
   * @param {number} pageSize - New page size (items per page)
   */
  function handlePageChange(page, pageSize) {
    todosStore.fetchTodos({ page, limit: pageSize })
  }

  /**
   * Handle sort change by updating the sort params and re-fetching from page 1.
   * @param {string} field - The field name to sort by (e.g. "updated_at")
   * @param {string} order - Sort direction ("asc" or "desc")
   */
  function handleSortChange(field, order) {
    todosStore.setSort(field, order)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle search by updating the search query and re-fetching from page 1.
   * @param {string} value - Search term to filter todos by title
   */
  function handleSearch(value) {
    todosStore.setSearch(value)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle row selection change from the table component.
   * Replaces the current selection with the provided row keys.
   * @param {string[]} selectedRowKeys - Array of selected todo IDs
   */
  function handleSelectionChange(selectedRowKeys) {
    todosStore.selectedIds = selectedRowKeys
  }

  /**
   * Check if a specific todo is currently selected.
   * @param {string} todoId - UUID of the todo to check
   * @returns {boolean} True if the todo is in the selected list
   */
  function isSelected(todoId) {
    return todosStore.selectedIds.includes(todoId)
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Store state (exposed as computed for reactivity without direct mutation)
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
    orgId: computed(() => todosStore.orgId),
    projectId: computed(() => todosStore.projectId),
    // Modal state
    isModalVisible,
    editingTodo,
    isEditing,
    // Validation rules
    titleRules,
    // Actions — multi-tenant context
    setContext,
    clearAll,
    // Actions — delegated directly from the store
    fetchTodos: todosStore.fetchTodos,
    fetchTodoById: todosStore.fetchTodoById,
    deleteTodo: todosStore.deleteTodo,
    bulkDelete: todosStore.bulkDelete,
    clearCurrentTodo: todosStore.clearCurrentTodo,
    // Actions — composable-level wrappers
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handlePageChange,
    handleSortChange,
    handleSearch,
    handleSelectionChange,
    isSelected,
  }
}
