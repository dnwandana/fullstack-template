import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
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
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Acme"))
    expect(wrapper.text()).not.toContain("Open invitation")
    expect(wrapper.text()).not.toContain("Decline")
  })

  it("renders the mockup columns with no Status column", async () => {
    mockInvitations([makeMyInvitation({ project_name: null })])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Acme"))
    expect(wrapper.findAll("th").map((th) => th.text())).toEqual([
      "Organization", "Project", "Invited by", "Role", "Expires", "Actions",
    ])
    const cells = wrapper.findAll("tbody td")
    expect(cells.map((td) => td.text()).slice(0, 5)).toEqual([
      "Acme", "-", "Ada Lovelace", "member", "Jan 1, 2026",
    ])
    expect(cells[0]?.classes()).toEqual(expect.arrayContaining(["font-medium", "whitespace-nowrap"]))
    expect(cells[1]?.classes()).toContain("text-muted-foreground")
    expect(cells[4]?.classes()).toEqual(expect.arrayContaining(["text-muted-foreground", "tabular-nums"]))
    expect(cells[5]?.classes()).toEqual(expect.arrayContaining(["w-[1%]", "text-right"]))
  })

  it("shows the project name in the default color when the invitation has one", async () => {
    mockInvitations([makeMyInvitation({ project_name: "Mobile App" })])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper?.text()).toContain("Mobile App"))
    expect(wrapper.findAll("tbody td")[1]?.classes()).not.toContain("text-muted-foreground")
  })

  it("shows 3 skeleton rows of 6 cells during the first load", async () => {
    vi.mocked(request.get).mockReset().mockReturnValue(new Promise(() => {}))
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    await flushPromises()
    const rows = wrapper.findAll('[data-slot="skeleton-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.findAll("td")).toHaveLength(6)
    expect(wrapper.text()).not.toContain("No pending invitations")
  })

  it("shows a Mail tile in the empty state", async () => {
    mockInvitations([])
    wrapper = mount(MyInvitationsView, { attachTo: document.body, global: { plugins: [createPinia()] } })
    // The first render shows the empty state before onMounted starts the fetch.
    await flushPromises()
    await vi.waitFor(() => expect(wrapper?.text()).toContain("No pending invitations"))
    expect(wrapper.find('[data-slot="empty-icon"] svg.lucide-mail').exists()).toBe(true)
  })
})
