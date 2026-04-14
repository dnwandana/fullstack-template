/**
 * Organizations composable - helpers for organization operations.
 * Bridges the orgs store and UI components by providing modal state,
 * validation rules, and convenience wrappers around store actions.
 */

import { ref, computed } from "vue"
import { useOrgsStore } from "@/stores/orgs"

/**
 * Composable for managing organization CRUD operations and modal UI state.
 * @returns {Object} Reactive state, computed properties, validation rules, and actions
 */
export function useOrgs() {
  const orgsStore = useOrgsStore()

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------

  /** @type {import('vue').Ref<boolean>} Whether the create/edit modal is visible */
  const isModalVisible = ref(false)

  /** @type {import('vue').Ref<Object|null>} The organization being edited, or null for create mode */
  const editingOrg = ref(null)

  // ---------------------------------------------------------------------------
  // Validation rules
  // ---------------------------------------------------------------------------

  /** Ant Design form validation rules for the organization name field */
  const nameRules = [
    { required: true, message: "Please enter an organization name" },
    { max: 100, message: "Name cannot exceed 100 characters" },
  ]

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  /**
   * Whether the modal is in edit mode (as opposed to create mode).
   * Determined by checking if an organization is loaded for editing.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const isEditing = computed(() => !!editingOrg.value)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Open the modal in create mode.
   * Resets editingOrg so the form starts empty.
   */
  function openCreateModal() {
    editingOrg.value = null
    isModalVisible.value = true
  }

  /**
   * Open the modal in edit mode with a shallow clone of the given organization.
   * Cloning prevents the form from mutating the store state directly.
   * @param {Object} org - The organization object to edit
   */
  function openEditModal(org) {
    editingOrg.value = { ...org }
    isModalVisible.value = true
  }

  /**
   * Close the modal and reset the editing state.
   */
  function closeModal() {
    isModalVisible.value = false
    editingOrg.value = null
  }

  /**
   * Handle form submission for both create and update operations.
   * Delegates to the appropriate store action based on whether we are editing
   * an existing organization or creating a new one, then closes the modal.
   * @param {Object} formData - The form data to submit
   * @param {string} formData.name - Organization name (required)
   * @param {string} [formData.description] - Optional description
   */
  async function handleSubmit(formData) {
    if (isEditing.value) {
      await orgsStore.updateOrg(editingOrg.value.id, formData)
    } else {
      await orgsStore.createOrg(formData)
    }
    closeModal()
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Store state (exposed as computed for reactivity without direct mutation)
    orgs: computed(() => orgsStore.orgs),
    currentOrg: computed(() => orgsStore.currentOrg),
    loading: computed(() => orgsStore.loading),
    // Modal state
    isModalVisible,
    editingOrg,
    isEditing,
    // Validation rules
    nameRules,
    // Actions — delegated directly from the store
    fetchOrgs: orgsStore.fetchOrgs,
    fetchOrgById: orgsStore.fetchOrgById,
    deleteOrg: orgsStore.deleteOrg,
    clearCurrentOrg: orgsStore.clearCurrentOrg,
    // Actions — composable-level wrappers
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
  }
}
