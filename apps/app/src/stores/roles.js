/**
 * Roles store - manages roles, permissions, and user permission state
 */

import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getRoles as apiGetRoles,
  getRole as apiGetRole,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
} from "@/api/roles"
import { getPermissions as apiGetPermissions } from "@/api/permissions"
import { getOrgMembers as apiGetOrgMembers } from "@/api/orgMembers"

export const useRolesStore = defineStore("roles", () => {
  // State
  const roles = ref([])
  const currentRole = ref(null)
  const allPermissions = ref([])
  const userPermissions = ref([])
  const loading = ref(false)

  // Actions

  /**
   * Fetch all roles for an organization (system + custom)
   * @param {string} orgId - Organization UUID
   * @returns {Promise<Object>} API response data
   */
  async function fetchRoles(orgId) {
    loading.value = true
    try {
      const response = await apiGetRoles(orgId)
      roles.value = response.data.data
      return response.data
    } catch {
      roles.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single role by ID with its assigned permissions
   * @param {string} orgId - Organization UUID
   * @param {string} roleId - Role UUID
   * @returns {Promise<Object>} API response data
   */
  async function fetchRoleById(orgId, roleId) {
    loading.value = true
    try {
      const response = await apiGetRole(orgId, roleId)
      currentRole.value = response.data.data
      return response.data
    } catch {
      currentRole.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new custom role in an organization
   * Refreshes the roles list after a successful creation
   * @param {string} orgId - Organization UUID
   * @param {Object} data - Role data
   * @param {string} data.name - Role name (required)
   * @param {string} [data.description] - Optional role description
   * @param {string[]} data.permissions - Array of permission UUIDs to assign
   * @returns {Promise<Object>} API response data
   */
  async function createRole(orgId, data) {
    loading.value = true
    try {
      const response = await apiCreateRole(orgId, data)
      message.success("Role created successfully!")
      // Refresh the roles list to include the newly created role
      await fetchRoles(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing role in an organization
   * Refreshes the roles list after a successful update
   * @param {string} orgId - Organization UUID
   * @param {string} roleId - Role UUID to update
   * @param {Object} data - Updated role data
   * @param {string} data.name - Role name (required)
   * @param {string} [data.description] - Optional role description
   * @param {string[]} data.permissions - Array of permission UUIDs to assign
   * @returns {Promise<Object>} API response data
   */
  async function updateRole(orgId, roleId, data) {
    loading.value = true
    try {
      const response = await apiUpdateRole(orgId, roleId, data)
      message.success("Role updated successfully!")
      // Refresh the roles list to reflect the changes
      await fetchRoles(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a custom role from an organization
   * Refreshes the roles list after a successful deletion
   * @param {string} orgId - Organization UUID
   * @param {string} roleId - Role UUID to delete
   * @returns {Promise<Object>} API response data
   */
  async function deleteRole(orgId, roleId) {
    loading.value = true
    try {
      const response = await apiDeleteRole(orgId, roleId)
      message.success("Role deleted successfully!")
      // Refresh the roles list to remove the deleted role
      await fetchRoles(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all available permissions in the system
   * Used when creating or editing roles to populate the permissions selector
   * @returns {Promise<Object>} API response data
   */
  async function fetchAllPermissions() {
    loading.value = true
    try {
      const response = await apiGetPermissions()
      allPermissions.value = response.data.data
      return response.data
    } catch {
      allPermissions.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Load the current user's permissions for a specific organization
   * This resolves the user's role within the org and extracts permission name strings.
   * Used to drive permission-based UI rendering (e.g., showing/hiding admin features).
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the current user
   * @returns {Promise<void>}
   */
  async function loadUserPermissions(orgId, userId) {
    loading.value = true
    try {
      // Step 1: Fetch all org members to find the current user's membership
      const membersResponse = await apiGetOrgMembers(orgId)
      const members = membersResponse.data.data

      // Step 2: Find the member entry that matches the given userId
      const member = members.find((m) => m.user_id === userId)

      if (!member) {
        // User is not a member of this org, so they have no permissions
        userPermissions.value = []
        return
      }

      // Step 3: Fetch the full role details (including permissions) for the member's role
      const roleResponse = await apiGetRole(orgId, member.role_id)
      const role = roleResponse.data.data

      // Step 4: Extract permission name strings from the role's permissions array
      userPermissions.value = role.permissions.map((p) => p.name)
    } catch {
      // On any failure, reset permissions to empty to prevent stale access
      userPermissions.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear roles and currentRole state
   * Used when navigating away from an org context to avoid stale data
   */
  function clearRoles() {
    roles.value = []
    currentRole.value = null
  }

  /**
   * Clear user permissions state
   * Used when switching orgs or logging out to prevent stale permission checks
   */
  function clearUserPermissions() {
    userPermissions.value = []
  }

  return {
    // State
    roles,
    currentRole,
    allPermissions,
    userPermissions,
    loading,
    // Actions
    fetchRoles,
    fetchRoleById,
    createRole,
    updateRole,
    deleteRole,
    fetchAllPermissions,
    loadUserPermissions,
    clearRoles,
    clearUserPermissions,
  }
})
