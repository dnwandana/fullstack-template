/**
 * Tenant context store.
 *
 * Resolves the current org and project reactively from route params, and caches
 * per-org member metadata and permission sets.
 *
 * Reactivity matters here in a way it does not in the views: views capture
 * `route.params.orgId` once at setup and rely on unmount/remount when the org
 * changes. The shell stays mounted across param changes, so it needs computeds.
 *
 * Reads the router singleton rather than useRoute(). useRoute() resolves via
 * inject(), which depends on an active component or app context — reliable in a
 * component, fragile in a Pinia setup store. router.currentRoute is a ref that
 * updates on every navigation and needs no injection context.
 */

import { ref, computed } from "vue"
import { defineStore } from "pinia"
import router from "@/router"
import { getOrgMembers } from "@/api/orgMembers"
import { getRole } from "@/api/roles"
import { useAuthStore } from "@/stores/auth"
import { useOrgsStore } from "@/stores/orgs"
import { useProjectsStore } from "@/stores/projects"
import { paramToString } from "@/utils/route-params"

/** One org's cached membership metadata. Read by the org switcher. */
export interface OrgMeta {
  memberCount: number
  roleId: string | null
  roleName: string | null
}

export const useTenantStore = defineStore("tenant", () => {
  const authStore = useAuthStore()
  const orgsStore = useOrgsStore()
  const projectsStore = useProjectsStore()

  const orgMeta = ref<Record<string, OrgMeta>>({})
  const permissions = ref<Record<string, string[]>>({})

  // Guards loadOrgs() against duplicate/in-flight calls — set synchronously
  // before the first await so a second call made before the request lands is
  // a no-op rather than a second GET /orgs.
  let orgsRequested = false

  const currentOrgId = computed(() => paramToString(router.currentRoute.value.params.orgId))
  const currentProjectId = computed(() => paramToString(router.currentRoute.value.params.projectId))

  const currentOrg = computed(() => orgsStore.orgs.find((o) => o.id === currentOrgId.value) ?? null)
  const currentProject = computed(
    () => projectsStore.projects.find((p) => p.id === currentProjectId.value) ?? null,
  )

  const permissionsReady = computed(
    () => currentOrgId.value !== null && currentOrgId.value in permissions.value,
  )

  /**
   * Fetch member count and the caller's role for one org. Idempotent — a cached
   * entry short-circuits without a request.
   */
  async function loadOrgMeta(orgId: string): Promise<void> {
    if (!orgId || orgId in orgMeta.value) return

    try {
      const response = await getOrgMembers(orgId)
      const members = response.data.data
      const mine = members.find((m) => m.user_id === authStore.user?.id)

      orgMeta.value[orgId] = {
        memberCount: members.length,
        roleId: mine?.role_id ?? null,
        roleName: mine?.role_name ?? null,
      }
    } catch {
      // Never leave the key absent on failure — an absent key means "not yet
      // loaded" and would make the switcher retry on every open.
      orgMeta.value[orgId] = { memberCount: 0, roleId: null, roleName: null }
    }
  }

  /** Fetch metadata for every org the user belongs to, in parallel. */
  async function loadAllOrgMeta(): Promise<void> {
    await Promise.all(orgsStore.orgs.map((o) => loadOrgMeta(o.id)))
  }

  /**
   * Populate the org list the first time anything needs it.
   *
   * This is the org switcher's and breadcrumb's only source of org names —
   * both derive `currentOrg` from `orgsStore.orgs`, and nothing else in the
   * shell fetches that list. Without this, a deep link straight into an org
   * (bookmark, email link, refresh) leaves `orgsStore.orgs` empty for the
   * whole session: no org name in the switcher, no way to switch orgs, and
   * the breadcrumb falls back to the raw UUID.
   *
   * Idempotent like loadOrgMeta/loadPermissions above, but keyed on a single
   * flag rather than a per-id cache since there is only one org list.
   */
  async function loadOrgs(): Promise<void> {
    if (orgsRequested) return
    orgsRequested = true
    await orgsStore.fetchOrgs()
  }

  /**
   * Resolve the caller's permission names for one org, reusing the cached
   * role id from loadOrgMeta rather than refetching members.
   */
  async function loadPermissions(orgId: string): Promise<void> {
    if (!orgId || orgId in permissions.value) return

    await loadOrgMeta(orgId)
    const roleId = orgMeta.value[orgId]?.roleId

    if (!roleId) {
      permissions.value[orgId] = []
      return
    }

    try {
      const response = await getRole(orgId, roleId)
      permissions.value[orgId] = response.data.data.permissions.map((p) => p.name)
    } catch {
      permissions.value[orgId] = []
    }
  }

  /**
   * Empty both caches. Called on logout.
   *
   * Without this, signing out and back in as a different user in the same tab
   * would answer permission checks from the previous user's cached role — a
   * privilege bug, not merely a staleness one.
   */
  function clear(): void {
    orgMeta.value = {}
    permissions.value = {}
    orgsRequested = false
  }

  /**
   * Invalidate one org's cached permissions (and its cached role metadata,
   * since the role name shown in the switcher may also now be wrong).
   *
   * Nothing currently re-resolves permissions except a fresh `loadPermissions`
   * call after a cache miss, so callers whose mutation can change what the
   * current user is allowed to do — a role's own permission set changing, or
   * the current user's own role assignment changing — must call this or the
   * UI keeps showing actions the server will now 403 (or hides ones that just
   * became available) until a hard refresh.
   */
  function invalidatePermissions(orgId: string): void {
    if (!orgId) return
    delete permissions.value[orgId]
    delete orgMeta.value[orgId]
  }

  return {
    orgMeta,
    permissions,
    currentOrgId,
    currentProjectId,
    currentOrg,
    currentProject,
    permissionsReady,
    loadOrgMeta,
    loadAllOrgMeta,
    loadOrgs,
    loadPermissions,
    clear,
    invalidatePermissions,
  }
})
