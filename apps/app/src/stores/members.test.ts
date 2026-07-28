import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

// tenant.ts reads the router singleton rather than useRoute() (see its own
// header comment); a plain `const currentRoute = ref(...)` would still be in
// its TDZ when the hoisted vi.mock factory below runs, so it has to be built
// via vi.hoisted. See stores/tenant.test.ts for the full rationale.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", () => ({ message: { success: vi.fn(), error: vi.fn() } }))

import { useMembersStore } from "./members"
import { useTenantStore } from "./tenant"
import { useAuthStore } from "./auth"

/** Seed a warm tenant cache for org "o1" so a wrongly-skipped invalidation is visible. */
function seedTenant() {
  const tenant = useTenantStore()
  tenant.permissions = { o1: ["org:read"] }
  tenant.orgMeta = { o1: { memberCount: 2, roleId: "r1", roleName: "Member" } }
  return tenant
}

describe("members store — permission cache invalidation (finding 3)", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentRoute.value = { params: { orgId: "o1" } }
    vi.mocked(request.get)
      .mockReset()
      .mockResolvedValue({ data: { data: [] }, status: 200 })
    vi.mocked(request.put)
      .mockReset()
      .mockResolvedValue({ data: { data: {} }, status: 200 })
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  })

  describe("updateOrgMemberRole", () => {
    it("invalidates the cache when the current user's own org role changes", async () => {
      const tenant = seedTenant()
      const members = useMembersStore()

      await members.updateOrgMemberRole("o1", "u1", "r2")

      expect(tenant.permissions).not.toHaveProperty("o1")
    })

    it("leaves the cache alone when a different member's org role changes", async () => {
      const tenant = seedTenant()
      const members = useMembersStore()

      await members.updateOrgMemberRole("o1", "someone-else", "r2")

      expect(tenant.permissions.o1).toEqual(["org:read"])
    })
  })

  describe("in-place membership update (L-26)", () => {
    const orgRow = (over = {}) => ({
      user_id: "u2",
      org_id: "o1",
      role_id: "r1",
      joined_at: "2026-07-01T00:00:00.000Z",
      name: "Two",
      email: "two@x.io",
      role_name: "member",
      ...over,
    })

    it("splices the returned org membership into the list without refetching", async () => {
      const members = useMembersStore()
      vi.mocked(request.get).mockResolvedValue({
        data: { data: [orgRow(), orgRow({ user_id: "u1" })] },
        status: 200,
      })
      await members.fetchOrgMembers("o1")
      expect(request.get).toHaveBeenCalledTimes(1)

      const updated = orgRow({ role_id: "r2", role_name: "admin" })
      vi.mocked(request.put).mockResolvedValue({
        data: { message: "OK", data: updated },
        status: 200,
      })
      await members.updateOrgMemberRole("o1", "u2", "r2")

      expect(request.get).toHaveBeenCalledTimes(1)
      expect(members.orgMembers).toHaveLength(2)
      expect(members.orgMembers[0]).toEqual(updated)
    })

    it("splices the returned project membership into the list without refetching", async () => {
      const projectRow = (over = {}) => {
        const { org_id: _org, ...row } = orgRow(over)
        return { ...row, project_id: "p1" }
      }
      const members = useMembersStore()
      vi.mocked(request.get).mockResolvedValue({ data: { data: [projectRow()] }, status: 200 })
      await members.fetchProjectMembers("o1", "p1")
      expect(request.get).toHaveBeenCalledTimes(1)

      const updated = projectRow({ role_id: "r2", role_name: "admin" })
      vi.mocked(request.put).mockResolvedValue({
        data: { message: "OK", data: updated },
        status: 200,
      })
      await members.updateProjectMemberRole("o1", "p1", "u2", "r2")

      expect(request.get).toHaveBeenCalledTimes(1)
      expect(members.projectMembers).toEqual([updated])
    })
  })

  describe("updateProjectMemberRole", () => {
    it("invalidates the cache when the current user's own project role changes", async () => {
      // Roles are org-scoped even when assigned to a project member (roles.org_id
      // is NOT NULL — see ProjectMembersView), so a project role change for the
      // current user still invalidates the org's permission cache.
      const tenant = seedTenant()
      const members = useMembersStore()

      await members.updateProjectMemberRole("o1", "p1", "u1", "r2")

      expect(tenant.permissions).not.toHaveProperty("o1")
    })

    it("leaves the cache alone when a different member's project role changes", async () => {
      const tenant = seedTenant()
      const members = useMembersStore()

      await members.updateProjectMemberRole("o1", "p1", "someone-else", "r2")

      expect(tenant.permissions.o1).toEqual(["org:read"])
    })
  })
})
