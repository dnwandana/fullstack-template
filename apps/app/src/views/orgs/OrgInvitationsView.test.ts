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
// the mock factory below runs. vi.hoisted is also hoisted, and awaiting it
// lets the ref exist before anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import OrgInvitationsView from "./OrgInvitationsView.vue"

const INVITATIONS = [
  { id: "i1", invitee_email: "new@example.com", status: "pending", role_name: "member" },
]

describe("OrgInvitationsView", () => {
  beforeEach(() => {
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
        if (url.endsWith("/invitations"))
          return Promise.resolve({ data: { data: INVITATIONS }, status: 200 })
        if (url.endsWith("/roles")) return Promise.resolve({ data: { data: [] }, status: 200 })
        if (url.endsWith("/members"))
          return Promise.resolve({
            data: { data: [{ user_id: "u1", role_id: "r1" }] },
            status: 200,
          })
        if (url.includes("/roles/"))
          return Promise.resolve({ data: { data: { permissions: [] } }, status: 200 })
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  })

  it("fetches org invitations and roles on mount", async () => {
    mount(OrgInvitationsView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/invitations")
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
    })
  })

  it("renders each invitation returned by the API", async () => {
    const wrapper = mount(OrgInvitationsView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("new@example.com"))
  })
})
