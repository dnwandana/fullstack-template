import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

// tenant.js reads the router singleton rather than useRoute() (see its own
// header comment); a plain `const currentRoute = ref(...)` would still be in
// its TDZ when the hoisted vi.mock factory below runs, so it has to be built
// via vi.hoisted. See stores/tenant.test.js for the full rationale.
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
    request.get.mockReset().mockResolvedValue({ data: { data: [] } })
    request.put.mockReset().mockResolvedValue({ data: { data: {} } })
    useAuthStore().user = { id: "u1" }
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
