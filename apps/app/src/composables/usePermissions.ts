/**
 * Permissions composable - thin wrapper around the tenant store's permission cache
 * Provides convenience methods for checking user permissions in components
 */

import { computed } from "vue"
import { useTenantStore } from "@/stores/tenant"

export function usePermissions() {
  const tenantStore = useTenantStore()

  /**
   * Permission names held in the org currently in the route, or [] if unresolved.
   *
   * The explicit null branch is not a behavior change: with no org in the route
   * the JavaScript original indexed the cache with `null`, which stringifies to
   * the key "null" — never present — and fell through to [].
   */
  const userPermissions = computed<string[]>(() => {
    const orgId = tenantStore.currentOrgId
    return orgId === null ? [] : (tenantStore.permissions[orgId] ?? [])
  })

  /**
   * Check if the current user has a specific permission (e.g., "org:update")
   */
  function can(permission: string): boolean {
    return userPermissions.value.includes(permission)
  }

  /**
   * Check if the current user has ANY of the given permissions
   */
  function canAny(permissions: string[]): boolean {
    return permissions.some((p) => userPermissions.value.includes(p))
  }

  /**
   * Load the current user's permissions for a specific organization.
   *
   * `_userId` is ignored. It is retained because five views still pass it; the
   * tenant store reads the current user from the auth store instead.
   */
  async function loadPermissions(orgId: string, _userId?: string): Promise<void> {
    await tenantStore.loadPermissions(orgId)
  }

  /**
   * Clear cached permissions and org metadata
   */
  function clearPermissions(): void {
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
