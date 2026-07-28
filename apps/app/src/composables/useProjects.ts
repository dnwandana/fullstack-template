/**
 * Projects composable - helpers for project operations within an organization.
 * Bridges the projects store and UI components by providing modal state,
 * validation rules, and convenience wrappers around store actions.
 */

import { ref, computed } from "vue"
import type { Project, Wire } from "@fullstack/contracts"
import type { ProjectInput } from "@/api/projects"
import { useProjectsStore } from "@/stores/projects"

/**
 * Composable for managing project CRUD operations and modal UI state.
 * Projects are always scoped to an organization, so most actions require
 * an orgId parameter.
 */
export function useProjects() {
  const projectsStore = useProjectsStore()

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------

  /** Whether the create/edit modal is visible */
  const isModalVisible = ref(false)

  /** The project being edited, or null for create mode */
  const editingProject = ref<Wire<Project> | null>(null)

  // ---------------------------------------------------------------------------
  // Validation rules
  // ---------------------------------------------------------------------------

  /** Ant Design form validation rules for the project name field */
  const nameRules = [
    { required: true, message: "Please enter an organization name" },
    { max: 100, message: "Name cannot exceed 100 characters" },
  ]

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  /**
   * Whether the modal is in edit mode (as opposed to create mode).
   * Determined by checking if a project is loaded for editing.
   */
  const isEditing = computed(() => !!editingProject.value)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Open the modal in create mode.
   * Resets editingProject so the form starts empty.
   */
  function openCreateModal(): void {
    editingProject.value = null
    isModalVisible.value = true
  }

  /**
   * Open the modal in edit mode with a shallow clone of the given project.
   * Cloning prevents the form from mutating the store state directly.
   */
  function openEditModal(project: Wire<Project>): void {
    editingProject.value = { ...project }
    isModalVisible.value = true
  }

  /**
   * Close the modal and reset the editing state.
   */
  function closeModal(): void {
    isModalVisible.value = false
    editingProject.value = null
  }

  /**
   * Handle form submission for both create and update operations.
   * Delegates to the appropriate store action based on whether we are editing
   * an existing project or creating a new one, then closes the modal.
   * Projects are scoped to an organization, so orgId is always required.
   * The ref is read into a local because control-flow analysis cannot narrow
   * `editingProject.value` through the `isEditing` computed. The local is
   * behaviour-identical: `isEditing` is exactly `!!editingProject.value`, and
   * nothing awaits between the two reads.
   */
  async function handleSubmit(orgId: string, formData: ProjectInput): Promise<void> {
    const editing = editingProject.value
    if (editing) {
      await projectsStore.updateProject(orgId, editing.id, formData)
    } else {
      await projectsStore.createProject(orgId, formData)
    }
    closeModal()
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Store state (exposed as computed for reactivity without direct mutation)
    projects: computed(() => projectsStore.projects),
    currentProject: computed(() => projectsStore.currentProject),
    loading: computed(() => projectsStore.loading),
    // Modal state
    isModalVisible,
    editingProject,
    isEditing,
    // Validation rules
    nameRules,
    // Actions — delegated directly from the store
    fetchProjects: projectsStore.fetchProjects,
    fetchProjectById: projectsStore.fetchProjectById,
    deleteProject: projectsStore.deleteProject,
    clearCurrentProject: projectsStore.clearCurrentProject,
    clearProjects: projectsStore.clearProjects,
    // Actions — composable-level wrappers
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
  }
}
