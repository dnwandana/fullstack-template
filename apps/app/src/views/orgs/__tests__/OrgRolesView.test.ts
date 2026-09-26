import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, okPaginated, makeOrgMember, makePermission, makeRole } from "@/test/fixtures"
import { request } from "@/utils/http"
import { useAuthStore } from "@/stores/auth"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const currentRoute = ref(...)` here would still be in its TDZ when
// the mock factory runs. vi.hoisted is *also* hoisted, and awaiting it lets
// the ref exist before anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import OrgRolesView from "../OrgRolesView.vue"

// `is_system` is set explicitly on both rows: the table tags the two kinds differently and gates
// Edit/Delete on it, so leaving it to a default would make the "System"/"Custom" case dishonest.
const ROLES = [
  makeRole({ id: "r1", name: "owner", description: null, is_system: true }),
  makeRole({
    id: "r2",
    name: "auditor",
    description: "Read only",
    is_system: false,
    permissions: [makePermission({ name: "todos:read" })],
  }),
]

describe("OrgRolesView", () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url.endsWith("/roles")) return Promise.resolve(ok(ROLES))
        if (url.endsWith("/permissions")) return Promise.resolve(ok([]))
        if (url.endsWith("/members"))
          return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
        if (url.includes("/roles/"))
          return Promise.resolve(ok(
            makeRole({
              id: "r1",
              is_system: true,
              permissions: [makePermission({ name: "org:manage_roles" })],
            }),
          ))
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  })

  it("fetches roles and the permission catalog on mount", async () => {
    mount(OrgRolesView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
      expect(request.get).toHaveBeenCalledWith("/permissions")
    })
  })

  it("badges system roles and custom roles differently", async () => {
    const wrapper = mount(OrgRolesView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("auditor"))
    const badges = wrapper.findAll("div.rounded-full")
    expect(badges.map((b) => b.text())).toEqual(["System", "Custom"])
    expect(badges[0]?.classes()).toContain("bg-info")
    expect(badges[1]?.classes()).toContain("bg-secondary")
  })

  it("offers Edit and Delete only for custom roles when the user may manage roles", async () => {
    const wrapper = mount(OrgRolesView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("auditor"))
    await vi.waitFor(() => {
      const labels = wrapper.findAll("button").map((b) => b.text())
      expect(labels.filter((l) => l === "Edit")).toHaveLength(1)
      expect(labels.filter((l) => l === "Delete")).toHaveLength(1)
    })
  })
})
