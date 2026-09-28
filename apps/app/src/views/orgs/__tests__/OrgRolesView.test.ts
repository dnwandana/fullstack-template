import { describe, it, expect, beforeEach, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
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

  function mockApi(permissionNames: string[]) {
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url.endsWith("/roles")) return Promise.resolve(ok(ROLES))
        if (url.endsWith("/permissions")) return Promise.resolve(ok([]))
        if (url.endsWith("/members"))
          return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
        if (url.includes("/roles/"))
          return Promise.resolve(
            ok(
              makeRole({
                id: "r1",
                is_system: true,
                permissions: permissionNames.map((name) => makePermission({ name })),
              }),
            ),
          )
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockApi(["org:manage_roles"])
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
    const badges = wrapper.findAll('[data-slot="badge"]')
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

  it("shows the permission count per role with tabular numbers", async () => {
    const wrapper = mount(OrgRolesView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("auditor"))
    const counts = wrapper.findAll('[data-slot="role-perm-count"]')
    expect(counts.map((c) => c.text())).toEqual(["0", "1"])
    expect(counts[0]?.classes()).toContain("tabular-nums")
    expect(wrapper.findAll("th").map((th) => th.text())).toContain("Permissions")
  })

  it("renders no Actions column without org:manage_roles", async () => {
    mockApi(["org:read"])
    const wrapper = mount(OrgRolesView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles/r1"))
    await vi.waitFor(() => expect(wrapper.text()).toContain("auditor"))
    await flushPromises()
    expect(wrapper.findAll("th").map((th) => th.text())).not.toContain("Actions")
    expect(wrapper.findAll("tbody tr")[0]?.findAll("td")).toHaveLength(4)
  })

  it("shows 4 skeleton rows during the first load", async () => {
    vi.mocked(request.get).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(OrgRolesView, { global: { plugins: [pinia] } })
    // fetchRoles sets the loading flag in onMounted, so the rows appear after one render.
    await flushPromises()
    expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(4)
  })
})
