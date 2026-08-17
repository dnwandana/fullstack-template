import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"
import { ok, makeUser } from "@/test/fixtures"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import router from "../index"

describe("legacy ?tab= redirects", () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url === "/auth/me") return Promise.resolve(ok(makeUser({ id: "u1" })))
        return Promise.resolve(ok([]))
      })
    await router.push("/orgs")
    await router.isReady()
  })

  it.each([
    ["members", "OrgMembers"],
    ["roles", "OrgRoles"],
    ["invitations", "OrgInvitations"],
  ])("sends ?tab=%s to %s", async (tab, name) => {
    await router.push(`/orgs/o1/settings?tab=${tab}`)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.params.orgId).toBe("o1")
    expect(router.currentRoute.value.query).toEqual({})
  })

  it("keeps ?tab=general on the settings page and strips the query", async () => {
    await router.push("/orgs/o1/settings?tab=general")
    expect(router.currentRoute.value.name).toBe("OrgSettings")
    expect(router.currentRoute.value.query).toEqual({})
  })

  it("treats an unrecognised tab as general rather than 404ing", async () => {
    await router.push("/orgs/o1/settings?tab=nonsense")
    expect(router.currentRoute.value.name).toBe("OrgSettings")
    expect(router.currentRoute.value.query).toEqual({})
  })

  it("leaves a query-free settings URL alone", async () => {
    await router.push("/orgs/o1/settings")
    expect(router.currentRoute.value.name).toBe("OrgSettings")
  })

  it("carries meta.permission on org-scoped routes", () => {
    const byName = (n: string) => router.getRoutes().find((r) => r.name === n)
    expect(byName("OrgMembers")?.meta.permission).toBe("org:read")
    expect(byName("OrgRoles")?.meta.permission).toBe("org:read")
    expect(byName("OrgInvitations")?.meta.permission).toBe("invitations:manage")
    expect(byName("OrgSettings")?.meta.permission).toBe("org:update")
    expect(byName("OrgAuditLog")?.meta.permission).toBe("audit:read")
    expect(byName("ProjectsList")?.meta.permission).toBe("project:read")
  })
})

describe("project routes", () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url === "/auth/me") return Promise.resolve(ok(makeUser({ id: "u1" })))
        return Promise.resolve(ok([]))
      })
    await router.push("/orgs")
    await router.isReady()
  })

  it.each([
    ["members", "ProjectMembers"],
    ["invitations", "ProjectInvitations"],
  ])("sends ?tab=%s to %s", async (tab, name) => {
    await router.push(`/orgs/o1/projects/p1/settings?tab=${tab}`)
    expect(router.currentRoute.value.name).toBe(name)
    expect(router.currentRoute.value.params).toMatchObject({ orgId: "o1", projectId: "p1" })
    expect(router.currentRoute.value.query).toEqual({})
  })

  it("has no project roles route", () => {
    // roles.org_id is NOT NULL and project members reuse org roles.
    expect(router.getRoutes().some((r) => r.name === "ProjectRoles")).toBe(false)
  })

  it("carries meta.permission on project-scoped routes", () => {
    const byName = (n: string) => router.getRoutes().find((r) => r.name === n)
    expect(byName("TodosList")?.meta.permission).toBe("todos:read")
    expect(byName("TodoDetail")?.meta.permission).toBe("todos:read")
    expect(byName("ProjectMembers")?.meta.permission).toBe("project:read")
    expect(byName("ProjectInvitations")?.meta.permission).toBe("invitations:manage")
    expect(byName("ProjectSettings")?.meta.permission).toBe("project:update")
  })
})
