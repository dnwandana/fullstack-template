import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import {
  ok,
  okPaginated,
  makeInvitationListItem,
  makeInvitationWithToken,
  makeOrgMember,
  makePermission,
  makeRole,
} from "@/test/fixtures"
import { request } from "@/utils/http"
import { toast } from "vue-sonner"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1", projectId: "p1" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const currentRoute = ref(...)` here would still be in its TDZ
// when the mock factory below runs. vi.hoisted is also hoisted, and
// awaiting it lets the ref exist before anything else in the file executes.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1", projectId: "p1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import ProjectInvitationsView from "../ProjectInvitationsView.vue"
import { useAuthStore } from "@/stores/auth"

// This view lists ORG invitations — the listing endpoint's `InvitationListItem` rows, not the
// token-bearing shape that only invite-create and resend return.
const INVITATIONS = [
  makeInvitationListItem({
    id: "i1",
    invitee_email: "new@example.com",
    status: "pending",
    role_name: "member",
  }),
]

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

describe("ProjectInvitationsView", () => {
  beforeEach(() => {
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url === "/orgs/o1/invitations") return Promise.resolve(okPaginated(INVITATIONS))
        if (url === "/orgs/o1/members")
          return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
        if (url.endsWith("/roles")) return Promise.resolve(ok([]))
        if (url.includes("/roles/"))
          return Promise.resolve(ok(makeRole({ id: "r1", permissions: [] })))
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  })

  it("lists org invitations, since there is no project-scoped listing", async () => {
    const wrapper = mount(ProjectInvitationsView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/invitations")
      expect(wrapper.text()).toContain("new@example.com")
    })
  })

  it("fetches org roles for the invite modal", async () => {
    mount(ProjectInvitationsView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles"))
  })

  it("copies a new link with one toast, as the org page does", async () => {
    vi.clearAllMocks()
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
    vi.mocked(request.get).mockImplementation((url: string) => {
      if (url === "/orgs/o1/invitations") return Promise.resolve(okPaginated(INVITATIONS))
      if (url === "/orgs/o1/members")
        return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
      if (url.endsWith("/roles")) return Promise.resolve(ok([]))
      if (url.includes("/roles/"))
        return Promise.resolve(
          ok(makeRole({ id: "r1", permissions: [makePermission({ name: "invitations:manage" })] })),
        )
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/invite/i1?token=abc" })),
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const wrapper = mount(ProjectInvitationsView, {
      attachTo: document.body,
      global: { plugins: [pinia] },
    })
    await vi.waitFor(() => expect(buttonByText("New link")).toBeTruthy())
    buttonByText("New link").click()
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Invitation link copied to clipboard"),
    )
    expect(request.post).toHaveBeenCalledWith("/orgs/o1/invitations/i1/resend")
    expect(writeText).toHaveBeenCalledWith("http://test/invite/i1?token=abc")
    expect(toast.success).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
