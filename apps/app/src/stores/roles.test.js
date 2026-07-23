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

import { useRolesStore } from "./roles"
import { useTenantStore } from "./tenant"
import { useAuthStore } from "./auth"

describe("roles store — permission cache invalidation (finding 3)", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentRoute.value = { params: { orgId: "o1" } }
    request.get.mockReset().mockResolvedValue({ data: { data: [] } })
    request.put.mockReset()
    useAuthStore().user = { id: "u1" }
  })

  it("invalidates the org's cached permissions after a role's permissions are updated", async () => {
    request.put.mockResolvedValue({ data: { data: { id: "r1", name: "Admin" } } })

    const tenant = useTenantStore()
    tenant.permissions = { o1: ["org:read"] }
    tenant.orgMeta = { o1: { memberCount: 2, roleId: "r1", roleName: "Admin" } }

    const roles = useRolesStore()
    await roles.updateRole("o1", "r1", { name: "Admin", permissions: [] })

    // The roles store cannot know whether the current user holds this role,
    // so it must invalidate unconditionally rather than leave a stale `can()`.
    expect(tenant.permissions).not.toHaveProperty("o1")
    expect(tenant.orgMeta).not.toHaveProperty("o1")
  })

  it("does not invalidate anything when the update request fails", async () => {
    request.put.mockRejectedValue(new Error("boom"))

    const tenant = useTenantStore()
    tenant.permissions = { o1: ["org:read"] }

    const roles = useRolesStore()
    await roles.updateRole("o1", "r1", { name: "Admin", permissions: [] })

    expect(tenant.permissions.o1).toEqual(["org:read"])
  })

  it("leaves other orgs' cached permissions untouched", async () => {
    request.put.mockResolvedValue({ data: { data: { id: "r1", name: "Admin" } } })

    const tenant = useTenantStore()
    tenant.permissions = { o1: ["org:read"], o2: ["org:read", "org:update"] }

    const roles = useRolesStore()
    await roles.updateRole("o1", "r1", { name: "Admin", permissions: [] })

    expect(tenant.permissions).not.toHaveProperty("o1")
    expect(tenant.permissions.o2).toEqual(["org:read", "org:update"])
  })
})
