/**
 * Roles composable - helpers for role CRUD operations and modal management
 * Manages create/edit modal state, validation rules, and delegates actions to the roles store
 */

import { ref, computed } from "vue"
import type { Role, Wire } from "@fullstack/contracts"
import type { RoleFormInput } from "@/api/roles"
import { useRolesStore } from "@/stores/roles"

export function useRoles() {
  const rolesStore = useRolesStore()

  // Local state for the create/edit role modal
  const isModalVisible = ref(false)
  const editingRole = ref<Wire<Role> | null>(null)

  // Derived state: true when editing an existing role, false when creating
  const isEditing = computed(() => !!editingRole.value)

  // Validation rules for the role form
  const nameRules = [{ required: true, message: "Please enter a role name" }]

  /**
   * Open the modal for creating a new role
   * Resets editingRole to null to indicate creation mode
   */
  function openCreateModal(): void {
    editingRole.value = null
    isModalVisible.value = true
  }

  /**
   * Open the modal for editing an existing role
   * Clones the role object to avoid mutating store state directly
   */
  function openEditModal(role: Wire<Role>): void {
    editingRole.value = { ...role }
    isModalVisible.value = true
  }

  /**
   * Close the modal and reset editing state
   */
  function closeModal(): void {
    isModalVisible.value = false
    editingRole.value = null
  }

  /**
   * Handle form submission for creating or updating a role
   * Determines the correct store action based on whether we are editing or creating
   */
  async function handleSubmit(orgId: string, formData: RoleFormInput): Promise<void> {
    // Read the ref into a local first: narrowing through the `isEditing` computed does not carry
    // over to `editingRole.value`, which would still be `Wire<Role> | null` at the call below.
    const editing = editingRole.value
    if (editing) {
      await rolesStore.updateRole(orgId, editing.id, formData)
    } else {
      await rolesStore.createRole(orgId, formData)
    }
    closeModal()
  }

  return {
    // Store state as computed
    roles: computed(() => rolesStore.roles),
    currentRole: computed(() => rolesStore.currentRole),
    allPermissions: computed(() => rolesStore.allPermissions),
    loading: computed(() => rolesStore.loading),
    // Local modal state
    isModalVisible,
    editingRole,
    isEditing,
    // Validation rules
    nameRules,
    // Delegated store actions
    fetchRoles: rolesStore.fetchRoles,
    fetchRoleById: rolesStore.fetchRoleById,
    deleteRole: rolesStore.deleteRole,
    fetchAllPermissions: rolesStore.fetchAllPermissions,
    clearRoles: rolesStore.clearRoles,
    // Composable actions
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
  }
}
