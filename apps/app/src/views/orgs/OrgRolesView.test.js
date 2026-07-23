import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia } from "pinia"
import { request } from "@/utils/http"

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

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import OrgRolesView from "./OrgRolesView.vue"

const ROLES = [
  { id: "r1", name: "owner", description: null, is_system: true },
  { id: "r2", name: "auditor", description: "Read only", is_system: false },
]

describe("OrgRolesView", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    request.get.mockReset().mockImplementation((url) => {
      if (url.endsWith("/roles")) return Promise.resolve({ data: { data: ROLES } })
      if (url.endsWith("/permissions")) return Promise.resolve({ data: { data: [] } })
      if (url.endsWith("/members"))
        return Promise.resolve({ data: { data: [{ user_id: "u1", role_id: "r1" }] } })
      if (url.includes("/roles/")) return Promise.resolve({ data: { data: { permissions: [] } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  it("fetches roles and the permission catalog on mount", async () => {
    mount(OrgRolesView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
      expect(request.get).toHaveBeenCalledWith("/permissions")
    })
  })

  it("tags system roles and custom roles differently", async () => {
    const wrapper = mount(OrgRolesView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("auditor"))
    expect(wrapper.text()).toContain("System")
    expect(wrapper.text()).toContain("Custom")
  })
})
