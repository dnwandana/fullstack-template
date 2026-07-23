/**
 * Permissions composable - thin wrapper around the tenant store's permission cache
 * Provides convenience methods for checking user permissions in components
 */

import { computed } from "vue"
import { useTenantStore } from "@/stores/tenant"

export function usePermissions() {
  const tenantStore = useTenantStore()

  /** Permission names held in the org currently in the route, or [] if unresolved. */
  const userPermissions = computed(() => tenantStore.permissions[tenantStore.currentOrgId] ?? [])

  /**
   * Check if the current user has a specific permission
   * @param {string} permission - Permission name to check (e.g., "org:update")
   * @returns {boolean} True if the user has the permission
   */
  function can(permission) {
    return userPermissions.value.includes(permission)
  }

  /**
   * Check if the current user has ANY of the given permissions
   * @param {string[]} permissions - Array of permission names to check
   * @returns {boolean} True if the user has at least one of the permissions
   */
  function canAny(permissions) {
    return permissions.some((p) => userPermissions.value.includes(p))
  }

  /**
   * Load the current user's permissions for a specific organization
   * @param {string} orgId - Organization UUID
   * @param {string} [_userId] - Ignored. Retained because five views still pass it;
   *   the tenant store reads the current user from the auth store instead.
   * @returns {Promise<void>}
   */
  async function loadPermissions(orgId, _userId) {
    await tenantStore.loadPermissions(orgId)
  }

  /**
   * Clear cached permissions and org metadata
   * @returns {void}
   */
  function clearPermissions() {
    tenantStore.clear()
  }

  return {
    userPermissions,
    can,
    canAny,
    loadPermissions,
    clearPermissions,
  }
}
