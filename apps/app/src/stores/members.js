/**
 * Members store - manages organization and project member state and operations
 */

import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getOrgMembers as apiGetOrgMembers,
  updateOrgMemberRole as apiUpdateOrgMemberRole,
  removeOrgMember as apiRemoveOrgMember,
} from "@/api/orgMembers"
import {
  getProjectMembers as apiGetProjectMembers,
  updateProjectMemberRole as apiUpdateProjectMemberRole,
  removeProjectMember as apiRemoveProjectMember,
} from "@/api/projectMembers"

export const useMembersStore = defineStore("members", () => {
  // State
  const orgMembers = ref([])
  const projectMembers = ref([])
  const loading = ref(false)

  // Actions

  /**
   * Fetch all members of an organization
   * @param {string} orgId - Organization UUID
   * @returns {Promise<Object>} API response data
   */
  async function fetchOrgMembers(orgId) {
    loading.value = true
    try {
      const response = await apiGetOrgMembers(orgId)
      orgMembers.value = response.data.data
      return response.data
    } catch {
      orgMembers.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Update the role assigned to an organization member
   * Refreshes the org members list after a successful update
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the member to update
   * @param {string} roleId - New role UUID to assign
   * @returns {Promise<Object>} API response data
   */
  async function updateOrgMemberRole(orgId, userId, roleId) {
    loading.value = true
    try {
      const response = await apiUpdateOrgMemberRole(orgId, userId, roleId)
      message.success("Member role updated successfully!")
      // Refresh the org members list to reflect the role change
      await fetchOrgMembers(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove a member from an organization
   * Refreshes the org members list after a successful removal
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the member to remove
   * @returns {Promise<Object>} API response data
   */
  async function removeOrgMember(orgId, userId) {
    loading.value = true
    try {
      const response = await apiRemoveOrgMember(orgId, userId)
      message.success("Member removed successfully!")
      // Refresh the org members list to remove the deleted member
      await fetchOrgMembers(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all members of a project
   * @param {string} orgId - Organization UUID that owns the project
   * @param {string} projectId - Project UUID
   * @returns {Promise<Object>} API response data
   */
  async function fetchProjectMembers(orgId, projectId) {
    loading.value = true
    try {
      const response = await apiGetProjectMembers(orgId, projectId)
      projectMembers.value = response.data.data
      return response.data
    } catch {
      projectMembers.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Update the role assigned to a project member
   * Refreshes the project members list after a successful update
   * @param {string} orgId - Organization UUID that owns the project
   * @param {string} projectId - Project UUID
   * @param {string} userId - User UUID of the member to update
   * @param {string} roleId - New role UUID to assign
   * @returns {Promise<Object>} API response data
   */
  async function updateProjectMemberRole(orgId, projectId, userId, roleId) {
    loading.value = true
    try {
      const response = await apiUpdateProjectMemberRole(orgId, projectId, userId, roleId)
      message.success("Member role updated successfully!")
      // Refresh the project members list to reflect the role change
      await fetchProjectMembers(orgId, projectId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove a member from a project
   * Refreshes the project members list after a successful removal
   * @param {string} orgId - Organization UUID that owns the project
   * @param {string} projectId - Project UUID
   * @param {string} userId - User UUID of the member to remove
   * @returns {Promise<Object>} API response data
   */
  async function removeProjectMember(orgId, projectId, userId) {
    loading.value = true
    try {
      const response = await apiRemoveProjectMember(orgId, projectId, userId)
      message.success("Member removed successfully!")
      // Refresh the project members list to remove the deleted member
      await fetchProjectMembers(orgId, projectId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear organization members state
   * Used when navigating away from an org context to avoid stale data
   */
  function clearOrgMembers() {
    orgMembers.value = []
  }

  /**
   * Clear project members state
   * Used when navigating away from a project context to avoid stale data
   */
  function clearProjectMembers() {
    projectMembers.value = []
  }

  return {
    // State
    orgMembers,
    projectMembers,
    loading,
    // Actions
    fetchOrgMembers,
    updateOrgMemberRole,
    removeOrgMember,
    fetchProjectMembers,
    updateProjectMemberRole,
    removeProjectMember,
    clearOrgMembers,
    clearProjectMembers,
  }
})
