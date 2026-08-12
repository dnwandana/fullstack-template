import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

// The store reads the router singleton rather than useRoute(), because
// inject()-based composables are fragile inside Pinia setup stores.
//
// vi.mock factories are hoisted above regular top-level statements (and
// this file's own local imports get converted to awaited dynamic imports
// that run ahead of any plain `const`), so a plain `const currentRoute =
// ref(...)` here would still be in its TDZ when the mock factory runs.
// vi.hoisted is *also* hoisted, and awaiting it lets the ref exist before
// anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  // Both params optional: this suite deliberately exercises the no-org route,
  // which is the case currentOrgId must return null for. Without the explicit
  // annotation the inferred `{ params: {} }` accepts literally any params
  // object, so a typo'd or wrongly-typed param would go unnoticed.
  const currentRoute = ref<{ params: { orgId?: string; projectId?: string } }>({ params: {} })
  return { currentRoute }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", () => ({ message: { success: vi.fn(), error: vi.fn() } }))

import { useTenantStore } from "../tenant"
import { useAuthStore } from "../auth"
import { useOrgsStore } from "../orgs"
import { ok, okPaginated, makeOrg, makeOrgMember, makePermission, makeRole } from "@/test/fixtures"

const MEMBERS = [
  makeOrgMember({ user_id: "u1", role_id: "r-owner", role_name: "owner" }),
  makeOrgMember({ user_id: "u2", role_id: "r-member", role_name: "member" }),
]
const READ = makePermission({
  id: "perm-org-read",
  name: "org:read",
  resource: "org",
  action: "read",
})
const UPDATE = makePermission({
  id: "perm-org-update",
  name: "org:update",
  resource: "org",
  action: "update",
})
const ROLE = makeRole({ id: "r-owner", name: "Owner", permissions: [READ, UPDATE] })
const ORGS = [makeOrg({ id: "o1", name: "Acme" })]

/** Count the GETs whose URL contains `fragment`. */
function getCalls(fragment: string): number {
  return vi.mocked(request.get).mock.calls.filter(([url]) => url.includes(fragment)).length
}

describe("tenant store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentRoute.value = { params: { orgId: "o1" } }
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url) => {
        if (url === "/orgs") return Promise.resolve(ok(ORGS))
        if (url.endsWith("/members")) return Promise.resolve(okPaginated(MEMBERS))
        if (url.includes("/roles/")) return Promise.resolve(ok(ROLE))
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  })

  it("derives currentOrgId from the route reactively", () => {
    const tenant = useTenantStore()
    expect(tenant.currentOrgId).toBe("o1")
    currentRoute.value = { params: { orgId: "o2", projectId: "p9" } }
    expect(tenant.currentOrgId).toBe("o2")
    expect(tenant.currentProjectId).toBe("p9")
  })

  it("caches org metadata after one request", async () => {
    const tenant = useTenantStore()
    await tenant.loadOrgMeta("o1")
    await tenant.loadOrgMeta("o1")
    expect(getCalls("/orgs/o1/members")).toBe(1)
    expect(tenant.orgMeta.o1).toEqual({ memberCount: 2, roleId: "r-owner", roleName: "owner" })
  })

  it("resolves permissions from cached metadata without refetching members", async () => {
    const tenant = useTenantStore()
    await tenant.loadOrgMeta("o1")
    await tenant.loadPermissions("o1")
    expect(getCalls("/orgs/o1/members")).toBe(1)
    expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles/r-owner")
    expect(tenant.permissions.o1).toEqual(["org:read", "org:update"])
  })

  it("does not refetch when switching org and back", async () => {
    const tenant = useTenantStore()
    await tenant.loadPermissions("o1")
    await tenant.loadPermissions("o2")
    await tenant.loadPermissions("o1")
    expect(getCalls("/members")).toBe(2)
    expect(getCalls("/roles/")).toBe(2)
  })

  it("reports permissionsReady only once the current org resolves", async () => {
    const tenant = useTenantStore()
    expect(tenant.permissionsReady).toBe(false)
    await tenant.loadPermissions("o1")
    expect(tenant.permissionsReady).toBe(true)
  })

  it("clear() empties both caches so the next user re-requests", async () => {
    const tenant = useTenantStore()
    await tenant.loadPermissions("o1")
    tenant.clear()
    expect(tenant.orgMeta).toEqual({})
    expect(tenant.permissions).toEqual({})
    await tenant.loadPermissions("o1")
    expect(getCalls("/orgs/o1/members")).toBe(2)
  })

  it("records an empty permission set when the user is not a member", async () => {
    useAuthStore().user = { id: "stranger", name: "Nemo", email: "nemo@example.com" }
    const tenant = useTenantStore()
    await tenant.loadPermissions("o1")
    expect(tenant.permissions.o1).toEqual([])
    expect(getCalls("/roles/")).toBe(0)
  })

  it("records an empty permission set when the request fails", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("boom"))
    const tenant = useTenantStore()
    await tenant.loadPermissions("o1")
    expect(tenant.permissions.o1).toEqual([])
  })

  describe("loadOrgs", () => {
    it("populates orgsStore.orgs so currentOrg resolves on a deep link", async () => {
      const tenant = useTenantStore()
      const orgsStore = useOrgsStore()
      expect(orgsStore.orgs).toEqual([])

      await tenant.loadOrgs()

      expect(orgsStore.orgs).toEqual(ORGS)
      expect(tenant.currentOrg).toEqual(ORGS[0])
    })

    it("does not issue a second GET /orgs for overlapping in-flight calls", async () => {
      const tenant = useTenantStore()
      await Promise.all([tenant.loadOrgs(), tenant.loadOrgs()])
      await tenant.loadOrgs()
      expect(getCalls("/orgs")).toBe(1)
    })

    it("is re-armed by clear(), so a different user's session re-requests", async () => {
      const tenant = useTenantStore()
      await tenant.loadOrgs()
      tenant.clear()
      await tenant.loadOrgs()
      expect(getCalls("/orgs")).toBe(2)
    })
  })

  describe("invalidatePermissions", () => {
    it("clears the cached permissions and org meta for one org so can() re-resolves", async () => {
      const tenant = useTenantStore()
      await tenant.loadPermissions("o1")
      expect(tenant.permissions.o1).toEqual(["org:read", "org:update"])

      // Simulate the role's permission set changing on the server.
      vi.mocked(request.get).mockImplementation((url) => {
        if (url === "/orgs") return Promise.resolve(ok(ORGS))
        if (url.endsWith("/members")) return Promise.resolve(okPaginated(MEMBERS))
        if (url.includes("/roles/"))
          return Promise.resolve(ok(makeRole({ ...ROLE, permissions: [READ] })))
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })

      tenant.invalidatePermissions("o1")
      expect(tenant.permissions).not.toHaveProperty("o1")
      expect(tenant.orgMeta).not.toHaveProperty("o1")

      await tenant.loadPermissions("o1")
      expect(tenant.permissions.o1).toEqual(["org:read"])
    })

    it("leaves other orgs' caches untouched", async () => {
      const tenant = useTenantStore()
      await tenant.loadPermissions("o1")
      await tenant.loadPermissions("o2")
      tenant.invalidatePermissions("o1")
      expect(tenant.permissions).not.toHaveProperty("o1")
      expect(tenant.permissions.o2).toEqual(["org:read", "org:update"])
    })
  })
})
