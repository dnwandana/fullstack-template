/**
 * Roles store - manages roles and the org's permission catalog
 */

import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import type { Envelope, Permission, Role, Wire } from "@fullstack/contracts"
import {
  getRoles as apiGetRoles,
  getRole as apiGetRole,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
  type RoleFormInput,
} from "@/api/roles"
import { getPermissions as apiGetPermissions } from "@/api/permissions"
import { useTenantStore } from "@/stores/tenant"

export const useRolesStore = defineStore("roles", () => {
  // State
  const roles = ref<Wire<Role>[]>([])
  const currentRole = ref<Wire<Role> | null>(null)
  const allPermissions = ref<Wire<Permission>[]>([])
  const loading = ref(false)

  // Actions

  /**
   * Fetch all roles for an organization (system + custom)
   */
  async function fetchRoles(orgId: string): Promise<Envelope<Wire<Role>[]> | undefined> {
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
   */
  async function fetchRoleById(
    orgId: string,
    roleId: string,
  ): Promise<Envelope<Wire<Role>> | undefined> {
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
   */
  async function createRole(
    orgId: string,
    data: RoleFormInput,
  ): Promise<Envelope<Wire<Role>> | undefined> {
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
   */
  async function updateRole(
    orgId: string,
    roleId: string,
    data: RoleFormInput,
  ): Promise<Envelope<Wire<Role>> | undefined> {
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
   */
  async function deleteRole(orgId: string, roleId: string): Promise<Envelope<null> | undefined> {
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
   */
  async function fetchAllPermissions(): Promise<Envelope<Wire<Permission>[]> | undefined> {
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
  function clearRoles(): void {
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
