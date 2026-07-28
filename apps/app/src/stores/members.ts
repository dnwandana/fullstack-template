/**
 * Members store - manages organization and project member state and operations
 */

import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import type {
  Envelope,
  OrgMember,
  PaginatedEnvelope,
  ProjectMember,
  Wire,
} from "@fullstack/contracts"
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
import { useAuthStore } from "@/stores/auth"
import { useTenantStore } from "@/stores/tenant"

export const useMembersStore = defineStore("members", () => {
  // State
  const orgMembers = ref<Wire<OrgMember>[]>([])
  const projectMembers = ref<Wire<ProjectMember>[]>([])
  const loading = ref(false)

  // Actions

  /**
   * Fetch all members of an organization
   */
  async function fetchOrgMembers(
    orgId: string,
  ): Promise<PaginatedEnvelope<Wire<OrgMember>[]> | undefined> {
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
   * Applies the returned membership row in place — no list refetch
   */
  async function updateOrgMemberRole(
    orgId: string,
    userId: string,
    roleId: string,
  ): Promise<Envelope<Wire<OrgMember>> | undefined> {
    loading.value = true
    try {
      const response = await apiUpdateOrgMemberRole(orgId, userId, roleId)
      message.success("Member role updated successfully!")
      // The API returns the updated membership row (same shape as the GET
      // list), so splice it in place instead of refetching the whole list.
      const updated = response.data.data
      const idx = orgMembers.value.findIndex((m) => m.user_id === updated.user_id)
      if (idx !== -1) orgMembers.value[idx] = updated
      // Only the affected member's own permission view can be stale — do not
      // invalidate every other signed-in member's session over someone else's
      // role change.
      if (userId === useAuthStore().user?.id) {
        useTenantStore().invalidatePermissions(orgId)
      }
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
   */
  async function removeOrgMember(
    orgId: string,
    userId: string,
  ): Promise<Envelope<null> | undefined> {
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
   */
  async function fetchProjectMembers(
    orgId: string,
    projectId: string,
  ): Promise<PaginatedEnvelope<Wire<ProjectMember>[]> | undefined> {
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
   * Applies the returned membership row in place — no list refetch
   */
  async function updateProjectMemberRole(
    orgId: string,
    projectId: string,
    userId: string,
    roleId: string,
  ): Promise<Envelope<Wire<ProjectMember>> | undefined> {
    loading.value = true
    try {
      const response = await apiUpdateProjectMemberRole(orgId, projectId, userId, roleId)
      message.success("Member role updated successfully!")
      // The API returns the updated membership row (same shape as the GET
      // list), so splice it in place instead of refetching the whole list.
      const updated = response.data.data
      const idx = projectMembers.value.findIndex((m) => m.user_id === updated.user_id)
      if (idx !== -1) projectMembers.value[idx] = updated
      // Roles are org-scoped even when assigned to a project member (see
      // ProjectMembersView), so the invalidation target is still the org's
      // cached permissions — only when the affected member is the caller.
      if (userId === useAuthStore().user?.id) {
        useTenantStore().invalidatePermissions(orgId)
      }
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
   */
  async function removeProjectMember(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<Envelope<null> | undefined> {
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
  function clearOrgMembers(): void {
    orgMembers.value = []
  }

  /**
   * Clear project members state
   * Used when navigating away from a project context to avoid stale data
   */
  function clearProjectMembers(): void {
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
