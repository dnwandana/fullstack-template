/**
 * Members composable - helpers for organization and project member operations
 * Manages role-change modal state and delegates CRUD actions to the members store
 */

import { ref, computed } from "vue"
import type { OrgMember, ProjectMember, Wire } from "@fullstack/contracts"
import { useMembersStore } from "@/stores/members"

/** Which membership table an action targets. Exported — the member views pass it through. */
export type MemberScope = "org" | "project"

/** The modal edits either kind of membership row; both share user_id, role_id and role_name. */
export type MemberRow = Wire<OrgMember> | Wire<ProjectMember>

export function useMembers() {
  const membersStore = useMembersStore()

  // Local state for the role-change modal
  const isRoleModalVisible = ref(false)
  const editingMember = ref<MemberRow | null>(null)

  /**
   * Open the role-change modal for a given member
   * Clones the member object to avoid mutating store state directly
   */
  function openRoleModal(member: MemberRow): void {
    editingMember.value = { ...member }
    isRoleModalVisible.value = true
  }

  /**
   * Close the role-change modal and reset editing state
   */
  function closeRoleModal(): void {
    editingMember.value = null
    isRoleModalVisible.value = false
  }

  /**
   * Handle changing a member's role at either the org or project scope
   * Delegates to the appropriate store action based on scope, then closes the modal
   */
  async function handleRoleChange(
    orgId: string,
    userId: string,
    roleId: string,
    scope: MemberScope,
    projectId?: string,
  ): Promise<void> {
    if (scope === "org") {
      await membersStore.updateOrgMemberRole(orgId, userId, roleId)
    } else if (scope === "project") {
      // `projectId` is optional in the signature but required by this branch. `String()` keeps the
      // missing-id request byte-identical to the JavaScript version rather than skipping the call.
      await membersStore.updateProjectMemberRole(orgId, String(projectId), userId, roleId)
    }
    closeRoleModal()
  }

  /**
   * Handle removing a member at either the org or project scope
   * Delegates to the appropriate store action based on scope
   */
  async function handleRemove(
    orgId: string,
    userId: string,
    scope: MemberScope,
    projectId?: string,
  ): Promise<void> {
    if (scope === "org") {
      await membersStore.removeOrgMember(orgId, userId)
    } else if (scope === "project") {
      // `projectId` is optional in the signature but required by this branch. `String()` keeps the
      // missing-id request byte-identical to the JavaScript version rather than skipping the call.
      await membersStore.removeProjectMember(orgId, String(projectId), userId)
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
