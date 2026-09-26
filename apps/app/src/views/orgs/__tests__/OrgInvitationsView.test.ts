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

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import OrgInvitationsView from "../OrgInvitationsView.vue"
import { useAuthStore } from "@/stores/auth"

// The listing endpoint returns `InvitationListItem` — the row shape with the resolved inviter,
// invitee and role names. `makeInvitationWithToken` would be wrong here: only invite-create and
// resend ever return the raw token and `accept_url`.
const INVITATIONS = [
  makeInvitationListItem({
    id: "i1",
    invitee_email: "new@example.com",
    status: "pending",
    role_name: "member",
  }),
]

const PERMS = ["invitations:create", "invitations:manage"]
let pinia = createPinia()

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

describe("OrgInvitationsView", () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
    vi.mocked(request.post).mockReset()
    vi.mocked(request.get)
      .mockReset()
      .mockImplementation((url: string) => {
        if (url.endsWith("/invitations")) return Promise.resolve(okPaginated(INVITATIONS))
        if (url.endsWith("/roles")) return Promise.resolve(ok([]))
        if (url.endsWith("/members"))
          return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
        if (url.includes("/roles/"))
          return Promise.resolve(
            ok(makeRole({ id: "r1", permissions: PERMS.map((name) => makePermission({ name })) })),
          )
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
  })

  it("fetches org invitations and roles on mount", async () => {
    mount(OrgInvitationsView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => {
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/invitations")
      expect(request.get).toHaveBeenCalledWith("/orgs/o1/roles")
    })
  })

  it("renders each invitation returned by the API", async () => {
    const wrapper = mount(OrgInvitationsView, { global: { plugins: [pinia] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("new@example.com"))
  })

  it("shows the new link in a dialog when the clipboard write rejects", async () => {
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/invite/i1?token=abc" })),
    )
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("insecure context")) },
    })
    const wrapper = mount(OrgInvitationsView, {
      attachTo: document.body,
      global: { plugins: [pinia] },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain("new@example.com"))
    await vi.waitFor(() => expect(buttonByText("New link")).toBeTruthy())
    buttonByText("New link").click()
    await vi.waitFor(() => {
      const link = document.body.querySelector<HTMLInputElement>("input[readonly]")
      expect(link?.value).toBe("http://test/invite/i1?token=abc")
    })
    expect(request.post).toHaveBeenCalledWith("/orgs/o1/invitations/i1/resend")
    expect(document.body.textContent).toContain("New invitation link")
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it("does not open the dialog when the clipboard write succeeds", async () => {
    vi.mocked(request.post).mockResolvedValue(ok(makeInvitationWithToken()))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const wrapper = mount(OrgInvitationsView, {
      attachTo: document.body,
      global: { plugins: [pinia] },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain("new@example.com"))
    await vi.waitFor(() => expect(buttonByText("New link")).toBeTruthy())
    buttonByText("New link").click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(document.body.querySelector("input[readonly]")).toBeNull()
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
