import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"
import { ok, okPaginated, makeOrgMember, makePermission, makeRole } from "@/test/fixtures"

// vi.mock factories are hoisted above regular top-level statements (see
// stores/tenant.test.ts for the full rationale), so the route ref must be
// built via vi.hoisted rather than a plain top-level `const ... = ref(...)`.
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

import { usePermissions } from "../usePermissions"
import { useAuthStore } from "@/stores/auth"
import { useTenantStore } from "@/stores/tenant"

describe("usePermissions", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentRoute.value = { params: { orgId: "o1" } }
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url.endsWith("/members"))
          return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
        if (url.includes("/roles/"))
          return Promise.resolve(
            ok(
              makeRole({
                permissions: [
                  makePermission({ name: "org:read", resource: "org", action: "read" }),
                ],
              }),
            ),
          )
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
    useAuthStore().user = { id: "u1", name: "Test User", email: "u1@example.com" }
  })

  it("resolves permissions for the current org, ignoring the userId argument", async () => {
    const { loadPermissions, can, userPermissions } = usePermissions()
    // Second argument is vestigial — pass a wrong id and it must not matter.
    await loadPermissions("o1", "ignored")
    expect(can("org:read")).toBe(true)
    expect(userPermissions.value).toEqual(["org:read"])
  })

  it("denies everything before permissions load", () => {
    const { can, canAny } = usePermissions()
    expect(can("org:read")).toBe(false)
    expect(canAny(["org:read", "org:update"])).toBe(false)
  })

  it("canAny is true when at least one permission is held", async () => {
    const { loadPermissions, canAny } = usePermissions()
    await loadPermissions("o1", "u1")
    expect(canAny(["org:delete", "org:read"])).toBe(true)
    expect(canAny(["org:delete"])).toBe(false)
  })

  it("answers against the org in the route, not the org last loaded", async () => {
    const { loadPermissions, can } = usePermissions()
    await loadPermissions("o1", "u1")
    currentRoute.value = { params: { orgId: "o2" } }
    // o2 has no cached entry yet, so nothing is granted.
    expect(can("org:read")).toBe(false)
  })

  it("clearPermissions empties the tenant caches", async () => {
    const { loadPermissions, clearPermissions } = usePermissions()
    await loadPermissions("o1", "u1")
    clearPermissions()
    expect(useTenantStore().permissions).toEqual({})
    expect(useTenantStore().orgMeta).toEqual({})
  })
})
