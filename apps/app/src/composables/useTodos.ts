/**
 * Todos composable - helpers for todo operations.
 * Bridges the todos store and UI components by providing modal state,
 * validation rules, and convenience wrappers around store actions.
 * Supports multi-tenant context via orgId and projectId.
 */

import { ref, computed } from "vue"
import type { Todo, Wire } from "@fullstack/contracts"
import type { TodoInput } from "@/api/todos"
import { useTodosStore } from "@/stores/todos"

/**
 * Composable for managing todo CRUD operations, modal UI state,
 * pagination, sorting, searching, and multi-tenant context.
 */
export function useTodos() {
  const todosStore = useTodosStore()

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------

  /** Whether the create/edit modal is visible */
  const isModalVisible = ref(false)

  /** The todo being edited, or null for create mode */
  const editingTodo = ref<Wire<Todo> | null>(null)

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
   */
  const isEditing = computed(() => !!editingTodo.value)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Set the multi-tenant context for todo operations.
   * Must be called before performing any API-based action so that
   * requests are scoped to the correct organization and project.
   */
  function setContext(orgId: string, projectId: string): void {
    todosStore.setContext(orgId, projectId)
  }

  /**
   * Clear all todo state and context.
   * Resets the store to its initial defaults, including the multi-tenant
   * context, pagination, sort, search, and selection state.
   */
  function clearAll(): void {
    todosStore.clearAll()
  }

  /**
   * Open the modal in create mode.
   * Resets editingTodo so the form starts empty.
   */
  function openCreateModal(): void {
    editingTodo.value = null
    isModalVisible.value = true
  }

  /**
   * Open the modal in edit mode with a shallow clone of the given todo.
   * Cloning prevents the form from mutating the store state directly.
   */
  function openEditModal(todo: Wire<Todo>): void {
    editingTodo.value = { ...todo }
    isModalVisible.value = true
  }

  /**
   * Close the modal and reset the editing state.
   */
  function closeModal(): void {
    isModalVisible.value = false
    editingTodo.value = null
  }

  /**
   * Handle form submission for both create and update operations.
   * Delegates to the appropriate store action based on whether we are editing
   * an existing todo or creating a new one, then closes the modal.
   * The ref is read into a local because control-flow analysis cannot narrow
   * `editingTodo.value` through the `isEditing` computed. The local is
   * behaviour-identical: `isEditing` is exactly `!!editingTodo.value`, and
   * nothing awaits between the two reads.
   */
  async function handleSubmit(formData: TodoInput): Promise<void> {
    const editing = editingTodo.value
    if (editing) {
      await todosStore.updateTodo(editing.id, formData)
    } else {
      await todosStore.createTodo(formData)
    }
    closeModal()
  }

  /**
   * Handle page or page size change by fetching the requested page.
   */
  function handlePageChange(page: number, pageSize: number): void {
    todosStore.fetchTodos({ page, limit: pageSize })
  }

  /**
   * Handle sort change by updating the sort params and re-fetching from page 1.
   */
  function handleSortChange(field: string, order: string): void {
    todosStore.setSort(field, order)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle search by updating the search query and re-fetching from page 1.
   */
  function handleSearch(value: string): void {
    todosStore.setSearch(value)
    todosStore.fetchTodos({ page: 1 })
  }

  /**
   * Handle row selection change from the table component.
   * Replaces the current selection with the provided row keys.
   * AntD types row keys as `string | number`; every key here is a todo UUID, so `String` is
   * identity — the map exists to satisfy the store's `string[]`, not to convert anything.
   */
  function handleSelectionChange(selectedRowKeys: (string | number)[]): void {
    todosStore.selectedIds = selectedRowKeys.map(String)
  }

  /**
   * Check if a specific todo is currently selected.
   */
  function isSelected(todoId: string): boolean {
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
