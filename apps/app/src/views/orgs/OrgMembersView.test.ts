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

import OrgMembersView from "./OrgMembersView.vue"

const MEMBERS = [{ user_id: "u1", name: "Ada", email: "ada@example.com", role_id: "r1" }]

describe("OrgMembersView", () => {
  beforeEach(() => {
    // Ant Design Vue's responsive grid reads matchMedia, which jsdom lacks.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url.endsWith("/members"))
          return Promise.resolve({ data: { data: MEMBERS }, status: 200 })
        if (url.endsWith("/roles")) return Promise.resolve({ data: { data: [] }, status: 200 })
        if (url.includes("/roles/"))
          return Promise.resolve({ data: { data: { permissions: [] } }, status: 200 })
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  })

  it("fetches org members and roles on mount", async () => {
    mount(OrgMembersView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/members")
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
    })
  })

  it("renders each member returned by the API", async () => {
    const wrapper = mount(OrgMembersView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("ada@example.com"))
  })
})
