/**
 * Permissions composable - thin wrapper around the roles store's permission state
 * Provides convenience methods for checking user permissions in components
 */

import { computed } from "vue"
import { useRolesStore } from "@/stores/roles"

export function usePermissions() {
  const rolesStore = useRolesStore()

  /**
   * Check if the current user has a specific permission
   * @param {string} permission - Permission name to check (e.g., "members:write")
   * @returns {boolean} True if the user has the permission
   */
  function can(permission) {
    return rolesStore.userPermissions.includes(permission)
  }

  /**
   * Check if the current user has ANY of the given permissions
   * Useful for UI sections that should be visible to users with at least one relevant permission
   * @param {string[]} permissions - Array of permission names to check
   * @returns {boolean} True if the user has at least one of the permissions
   */
  function canAny(permissions) {
    return permissions.some((p) => rolesStore.userPermissions.includes(p))
  }

  /**
   * Load the current user's permissions for a specific organization
   * Delegates to the roles store which resolves the user's role and extracts permission names
   * @param {string} orgId - Organization UUID
   * @param {string} userId - User UUID of the current user
   * @returns {Promise<void>}
   */
  async function loadPermissions(orgId, userId) {
    await rolesStore.loadUserPermissions(orgId, userId)
  }

  /**
   * Clear the current user's permissions state
   * Should be called when switching orgs or logging out to prevent stale permission checks
   * @returns {void}
   */
  function clearPermissions() {
    rolesStore.clearUserPermissions()
  }

  return {
    // Store state as computed
    userPermissions: computed(() => rolesStore.userPermissions),
    // Permission check methods
    can,
    canAny,
    // Lifecycle actions
    loadPermissions,
    clearPermissions,
  }
}
