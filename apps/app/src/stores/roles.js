/**
 * Roles store - manages roles and the org's permission catalog
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
import { useTenantStore } from "@/stores/tenant"

export const useRolesStore = defineStore("roles", () => {
  // State
  const roles = ref([])
  const currentRole = ref(null)
  const allPermissions = ref([])
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
      // The role's own permission set may have just changed under any member
      // who holds it, including the current user. This store has no
      // visibility into who holds which role, so invalidate the org's cached
      // permissions unconditionally rather than leave `can()` answering from
      // a stale set until a hard refresh.
      useTenantStore().invalidatePermissions(orgId)
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
   * Clear roles and currentRole state
   * Used when navigating away from an org context to avoid stale data
   */
  function clearRoles() {
    roles.value = []
    currentRole.value = null
  }

  return {
    // State
    roles,
    currentRole,
    allPermissions,
    loading,
    // Actions
    fetchRoles,
    fetchRoleById,
    createRole,
    updateRole,
    deleteRole,
    fetchAllPermissions,
    clearRoles,
  }
})
