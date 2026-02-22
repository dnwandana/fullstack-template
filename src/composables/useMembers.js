/**
 * Members composable - helpers for organization and project member operations
 * Manages role-change modal state and delegates CRUD actions to the members store
 */

import { ref, computed } from "vue"
import { useMembersStore } from "@/stores/members"

export function useMembers() {
  const membersStore = useMembersStore()

  // Local state for the role-change modal
  const isRoleModalVisible = ref(false)
  const editingMember = ref(null)

  /**
   * Open the role-change modal for a given member
   * Clones the member object to avoid mutating store state directly
   * @param {Object} member - Member object whose role is being changed
   * @returns {void}
   */
  function openRoleModal(member) {
    editingMember.value = { ...member }
    isRoleModalVisible.value = true
  }

  /**
   * Close the role-change modal and reset editing state
   * @returns {void}
   */
  function closeRoleModal() {
    editingMember.value = null
    isRoleModalVisible.value = false
  }

  /**
   * Handle changing a member's role at either the org or project scope
   * Delegates to the appropriate store action based on scope, then closes the modal
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the member to update
   * @param {string} roleId - New role UUID to assign
   * @param {string} scope - Either "org" or "project"
   * @param {string} [projectId] - Project UUID (required when scope is "project")
   * @returns {Promise<void>}
   */
  async function handleRoleChange(orgId, userId, roleId, scope, projectId) {
    if (scope === "org") {
      await membersStore.updateOrgMemberRole(orgId, userId, roleId)
    } else if (scope === "project") {
      await membersStore.updateProjectMemberRole(orgId, projectId, userId, roleId)
    }
    closeRoleModal()
  }

  /**
   * Handle removing a member at either the org or project scope
   * Delegates to the appropriate store action based on scope
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the member to remove
   * @param {string} scope - Either "org" or "project"
   * @param {string} [projectId] - Project UUID (required when scope is "project")
   * @returns {Promise<void>}
   */
  async function handleRemove(orgId, userId, scope, projectId) {
    if (scope === "org") {
      await membersStore.removeOrgMember(orgId, userId)
    } else if (scope === "project") {
      await membersStore.removeProjectMember(orgId, projectId, userId)
    }
  }

  return {
    // Store state as computed
    orgMembers: computed(() => membersStore.orgMembers),
    projectMembers: computed(() => membersStore.projectMembers),
    loading: computed(() => membersStore.loading),
    // Local modal state
    isRoleModalVisible,
    editingMember,
    // Delegated store actions
    fetchOrgMembers: membersStore.fetchOrgMembers,
    fetchProjectMembers: membersStore.fetchProjectMembers,
    clearOrgMembers: membersStore.clearOrgMembers,
    clearProjectMembers: membersStore.clearProjectMembers,
    // Composable actions
    openRoleModal,
    closeRoleModal,
    handleRoleChange,
    handleRemove,
  }
}
