import { mount, flushPromises, type VueWrapper } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import InviteAcceptView from "@/views/invitations/InviteAcceptView.vue"
import { useAuthStore } from "@/stores/auth"
import { ok, makeInvitation, makeInvitationPreview, makeUser } from "@/test/fixtures"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ant-design-vue")>()
  return { ...actual, message: { success: vi.fn(), error: vi.fn() } }
})

/** The slice of the route this view reads. Every key is optional because the
 *  no-token case arrives with nothing but an id. */
interface TestRoute {
  params?: { invitationId: string }
  query?: { token?: string }
  fullPath?: string
}

// `currentRoute` is mutated per test — the in-app invitation list links here
// by ID with no `?token=`, which is a distinct case from a rejected token.
const { push, currentRoute } = vi.hoisted(() => {
  const currentRoute: TestRoute = {}
  return { push: vi.fn(), currentRoute }
})

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

/** The invitee this invitation is addressed to. `wrong-account` keys off this value alone. */
const INVITEE_EMAIL = "new@acme.com"
const ORG_NAME = "Acme Corp"

/**
 * The public preview payload every state below starts from: pending, unexpired, for someone with
 * no account yet.
 *
 * `makeInvitationPreview`, never `makeInvitation` — the preview endpoint is public and token-gated
 * and withholds `org_id`, `inviter_id` and `role_id` by design, so a full invitation here would let
 * a spec assert on fields the real response never carries. Each render state below is selected by
 * overriding exactly the one field that drives it.
 */
const preview = (overrides: Parameters<typeof makeInvitationPreview>[0] = {}) =>
  makeInvitationPreview({
    id: "inv-1",
    org_name: ORG_NAME,
    invitee_email: INVITEE_EMAIL,
    requires_signup: true,
    ...overrides,
  })

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
    vi.mocked(request.get).mockResolvedValue(ok(preview()))

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("Ada Lovelace")
    expect(wrapper.text()).toContain("Acme Corp")
    expect(wrapper.text()).toContain("member")
  })

  it("shows an error state when the link is invalid", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("404"))

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
    vi.mocked(request.get).mockResolvedValue(ok(preview({ is_expired: true })))

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("expired")
  })

  it("offers signup when the invitee has no account", async () => {
    vi.mocked(request.get).mockResolvedValue(ok(preview({ requires_signup: true })))

    const wrapper = mount(InviteAcceptView, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.text()).toContain("Create account")
  })

  /**
   * Mount in the "ready" state: signed in as the invitee, invitation still
   * pending. Returns the wrapper once the preview has resolved.
   */
  const mountReady = async () => {
    vi.mocked(request.get).mockResolvedValue(ok(preview({ requires_signup: false })))

    const pinia = createPinia()
    setActivePinia(pinia)
    // Signed in *as the invitee* — a different email here would render `wrong-account` instead.
    useAuthStore().user = makeUser({ id: "u-1", name: "New Person", email: INVITEE_EMAIL })

    const wrapper = mount(InviteAcceptView, { global: { plugins: [pinia] } })
    await flushPromises()

    // The list refresh that follows a successful accept is a separate GET.
    vi.mocked(request.get).mockResolvedValue(ok([]))
    return wrapper
  }

  const acceptButton = (wrapper: VueWrapper) => {
    const found = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Accept invitation"))
    // `Array.prototype.find` is optional-typed; a missing button must still fail loudly.
    if (!found) throw new Error("no Accept invitation button rendered")
    return found
  }

  it("navigates to the org list after a successful accept", async () => {
    const wrapper = await mountReady()
    // The accept endpoint returns the plain invitation row, not the public preview projection.
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitation({ id: "inv-1", status: "accepted" })),
    )

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
    vi.mocked(request.post).mockRejectedValue(new Error("404"))

    await acceptButton(wrapper).trigger("click")
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })
})
