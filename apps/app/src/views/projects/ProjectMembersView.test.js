import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia } from "pinia"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1", projectId: "p1" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const currentRoute = ref(...)` here would still be in its TDZ when
// the mock factory runs. vi.hoisted is *also* hoisted, and awaiting it lets
// the ref exist before anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1", projectId: "p1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import ProjectMembersView from "./ProjectMembersView.vue"

const MEMBERS = [{ user_id: "u1", name: "Ada", email: "ada@example.com", role_id: "r1" }]

describe("ProjectMembersView", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    request.get.mockReset().mockImplementation((url) => {
      if (url === "/orgs/o1/projects/p1/members")
        return Promise.resolve({ data: { data: MEMBERS } })
      if (url === "/orgs/o1/members")
        return Promise.resolve({ data: { data: [{ user_id: "u1", role_id: "r1" }] } })
      if (url.endsWith("/roles")) return Promise.resolve({ data: { data: [] } })
      if (url.includes("/roles/")) return Promise.resolve({ data: { data: { permissions: [] } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    request.put.mockReset().mockResolvedValue({ data: { data: {} } })
  })

  it("fetches project members and org roles on mount", async () => {
    mount(ProjectMembersView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/projects/p1/members")
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
    })
  })

  it("renders each project member returned by the API", async () => {
    const wrapper = mount(ProjectMembersView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("ada@example.com"))
  })

  it("targets the project membership, not the org membership, on role change", async () => {
    const wrapper = mount(ProjectMembersView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("ada@example.com"))

    wrapper.findComponent({ name: "MembersTable" }).vm.$emit("role-change", {
      userId: "u1",
      roleId: "r2",
    })

    await vi.waitFor(() =>
      expect(request.put).toHaveBeenCalledWith("/orgs/o1/projects/p1/members/u1", {
        role_id: "r2",
      }),
    )
  })
})
