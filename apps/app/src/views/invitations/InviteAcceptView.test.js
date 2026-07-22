import { mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import InviteAcceptView from "@/views/invitations/InviteAcceptView.vue"
import { useAuthStore } from "@/stores/auth"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, message: { success: vi.fn(), error: vi.fn() } }
})

// `currentRoute` is mutated per test — the in-app invitation list links here
// by ID with no `?token=`, which is a distinct case from a rejected token.
const { push, currentRoute } = vi.hoisted(() => ({
  push: vi.fn(),
  currentRoute: {},
}))

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => currentRoute,
}))

/** Route state for arriving on a full invitation link, token and all. */
const routeWithToken = () => ({
  params: { invitationId: "inv-1" },
  query: { token: "a".repeat(64) },
  fullPath: `/invite/inv-1?token=${"a".repeat(64)}`,
})

const preview = {
  id: "inv-1",
  org_name: "Acme Corp",
  project_name: null,
  inviter_name: "Ada Lovelace",
  role_name: "member",
  invitee_email: "new@acme.com",
  status: "pending",
  is_expired: false,
  requires_signup: true,
}

describe("InviteAcceptView", () => {
  // jsdom does not implement matchMedia; Ant Design Vue's grid subscribes to it on mount.
  beforeAll(() => {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.assign(currentRoute, routeWithToken())
  })

  it("shows who invited you and to what", async () => {
    request.get.mockResolvedValue({ data: { data: preview } })

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("Ada Lovelace")
    expect(wrapper.text()).toContain("Acme Corp")
    expect(wrapper.text()).toContain("member")
  })

  it("shows an error state when the link is invalid", async () => {
    request.get.mockRejectedValue(new Error("404"))

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("no longer valid")
  })

  // The in-app list at /invitations links here by ID alone — it never holds a
  // token. Rendering "no longer valid" there tells users their perfectly good
  // invitation was revoked, so the two cases must stay distinct.
  it("asks the user to open the emailed link when the URL carries no token", async () => {
    currentRoute.query = {}
    currentRoute.fullPath = "/invite/inv-1"

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("Open this invitation from your email")
    expect(wrapper.text()).not.toContain("no longer valid")
    // No credential to send, so no point asking the API.
    expect(request.get).not.toHaveBeenCalled()
  })

  it("shows an expired state for an expired invitation", async () => {
    request.get.mockResolvedValue({ data: { data: { ...preview, is_expired: true } } })

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("expired")
  })

  it("offers signup when the invitee has no account", async () => {
    request.get.mockResolvedValue({ data: { data: preview } })

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("Create account")
  })

  /**
   * Mount in the "ready" state: signed in as the invitee, invitation still
   * pending. Returns the wrapper once the preview has resolved.
   */
  const mountReady = async () => {
    request.get.mockResolvedValue({
      data: { data: { ...preview, requires_signup: false } },
    })

    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { id: "u-1", name: "New Person", email: preview.invitee_email }

    const wrapper = mount(InviteAcceptView, { global: { plugins: [pinia] } })
    await flushPromises()

    // The list refresh that follows a successful accept is a separate GET.
    request.get.mockResolvedValue({ data: { data: [] } })
    return wrapper
  }

  const acceptButton = (wrapper) =>
    wrapper.findAll("button").find((button) => button.text().includes("Accept invitation"))

  it("navigates to the org list after a successful accept", async () => {
    const wrapper = await mountReady()
    request.post.mockResolvedValue({ data: { data: { id: "inv-1", status: "accepted" } } })

    await acceptButton(wrapper).trigger("click")
    await flushPromises()

    expect(request.post).toHaveBeenCalledWith("/invitations/inv-1/accept", {
      token: "a".repeat(64),
    })
    expect(push).toHaveBeenCalledWith("/orgs")
  })

  it("stays put when the accept fails rather than implying membership was granted", async () => {
    const wrapper = await mountReady()
    // The invitation was revoked or claimed elsewhere between preview and click.
    request.post.mockRejectedValue(new Error("404"))

    await acceptButton(wrapper).trigger("click")
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })
})
