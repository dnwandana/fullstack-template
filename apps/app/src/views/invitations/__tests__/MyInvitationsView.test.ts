import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mount, type VueWrapper } from "@vue/test-utils"
import { createPinia } from "pinia"
import { ok, makeMyInvitation } from "@/test/fixtures"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

// `push` is hoisted so one spy survives every `useRouter()` call.
const { push } = await vi.hoisted(async () => {
  return { push: vi.fn() }
})
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: {} }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import MyInvitationsView from "../MyInvitationsView.vue"

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

function mockInvitations(rows: ReturnType<typeof makeMyInvitation>[]): void {
  vi.mocked(request.get)
    .mockReset()
    .mockImplementation((url: string) => {
      if (url === "/invitations") return Promise.resolve(ok(rows))
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
}

describe("MyInvitationsView", () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    push.mockReset()
    vi.mocked(request.post).mockReset()
  })
  afterEach(() => wrapper?.unmount())

  it("lists the invitation with its organization and an open action", async () => {
    mockInvitations([makeMyInvitation({ id: "inv1", status: "pending" })])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Acme"))
    expect(wrapper.text()).toContain("Open invitation")
  })

  it("opens the invite landing page for the row", async () => {
    mockInvitations([makeMyInvitation({ id: "inv1", status: "pending" })])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Open invitation"))
    buttonByText("Open invitation").click()
    expect(push).toHaveBeenCalledWith({ name: "InviteAccept", params: { invitationId: "inv1" } })
  })

  it("shows the empty state when there are no invitations", async () => {
    mockInvitations([])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("No pending invitations"))
  })

  it("declines the invitation after the confirmation", async () => {
    mockInvitations([makeMyInvitation({ id: "inv1", status: "pending" })])
    vi.mocked(request.post).mockResolvedValue(ok(null))
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Decline"))
    buttonByText("Decline").click()
    await vi.waitFor(() => expect(buttonByText("Yes")).toBeTruthy())
    buttonByText("Yes").click()
    await vi.waitFor(() =>
      expect(request.post).toHaveBeenCalledWith("/invitations/inv1/decline"),
    )
  })

  it("renders no actions for a row that is not pending", async () => {
    mockInvitations([makeMyInvitation({ id: "inv2", status: "accepted" })])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("accepted"))
    expect(wrapper.text()).not.toContain("Open invitation")
    expect(wrapper.text()).not.toContain("Decline")
  })
})
