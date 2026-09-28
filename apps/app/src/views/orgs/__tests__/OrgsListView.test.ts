import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, okPaginated, makeOrg, makeOrgMember, makeUser } from "@/test/fixtures"
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

import OrgsListView from "../OrgsListView.vue"
import { useAuthStore } from "@/stores/auth"

const RouterLinkStub = { props: ["to"], template: '<a :href="String(to)"><slot /></a>' }

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = makeUser({ id: "u1" })
  return mount(OrgsListView, {
    attachTo: document.body,
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe("OrgsListView", () => {
  beforeEach(() => {
    push.mockReset()
    vi.mocked(request.get).mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders a table row per organization that opens the org on click", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([makeOrg(), makeOrg({ id: "o2", name: "Globex" })]))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("Globex"))

    const rows = wrapper.findAll('[data-slot="org-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]?.attributes("tabindex")).toBe("0")
    expect(rows[1]?.find('a[href="/orgs/o2"]').text()).toContain("View Projects")
    await rows[1]?.trigger("click")
    expect(push).toHaveBeenCalledWith("/orgs/o2")
  })

  it("opens the org on Enter", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([makeOrg({ id: "o1" })]))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.find('[data-slot="org-row"]').exists()).toBe(true))
    await wrapper.find('[data-slot="org-row"]').trigger("keydown", { key: "Enter" })
    expect(push).toHaveBeenCalledWith("/orgs/o1")
  })

  // Review Focus 3: the link navigates by itself, so the row must not navigate a second time.
  it("does not navigate from the row for a click or Enter on the link", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([makeOrg({ id: "o1" })]))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.find('[data-slot="org-row"] a').exists()).toBe(true))
    const link = wrapper.find('[data-slot="org-row"] a')
    await link.trigger("click")
    await link.trigger("keydown", { key: "Enter" })
    expect(push).not.toHaveBeenCalled()
  })

  it("shows 4 skeleton rows during the first load", async () => {
    vi.mocked(request.get).mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    // `loading` turns true inside `onMounted`, so the skeleton rows show after the next render.
    await vi.waitFor(() => expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(4))
  })

  it("shows No description in italic for an empty description", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([makeOrg({ description: null })]))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("No description"))
    expect(wrapper.find('[data-slot="org-desc"]').classes()).toContain("italic")
  })

  it("shows the empty state with a create button when there are no orgs", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([]))
    const wrapper = mountView()
    // The empty state also shows before the mount fetch starts, so wait for the fetch to end.
    await vi.waitFor(() => expect(request.get).toHaveBeenCalled())
    await flushPromises()
    expect(wrapper.text()).toContain("No organizations yet")
    expect(wrapper.text()).toContain("Create your first organization")
  })

  // Review Focus 4: one failed member request shows "-" for that org only.
  it("shows the member count and role per org, and - for a failed org", async () => {
    const orgs = [makeOrg({ id: "o1" }), makeOrg({ id: "o2", name: "Globex" })]
    vi.mocked(request.get).mockImplementation((url) => {
      if (url === "/orgs") return Promise.resolve(ok(orgs))
      if (url === "/orgs/o1/members")
        return Promise.resolve(
          okPaginated([
            makeOrgMember({ user_id: "u1", role_name: "owner" }),
            makeOrgMember({ user_id: "u2" }),
          ]),
        )
      return Promise.reject(new Error(`GET ${url} failed`))
    })
    const wrapper = mountView()
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-slot="org-members"]')[0]?.text()).toBe("2 members"),
    )

    const [first, second] = wrapper.findAll('[data-slot="org-row"]')
    expect(first?.find('[data-slot="org-role"] [data-slot="badge"]').text()).toBe("owner")
    await vi.waitFor(() => expect(second?.find('[data-slot="org-members"]').text()).toBe("-"))
    expect(second?.find('[data-slot="org-role"]').text()).toBe("-")
  })

  it("shows a skeleton in the meta cells until the members arrive", async () => {
    vi.mocked(request.get).mockImplementation((url) =>
      url === "/orgs" ? Promise.resolve(ok([makeOrg()])) : new Promise(() => {}),
    )
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.find('[data-slot="org-row"]').exists()).toBe(true))
    expect(wrapper.find('[data-slot="org-members"] .animate-pulse').exists()).toBe(true)
    expect(wrapper.find('[data-slot="org-role"] .animate-pulse').exists()).toBe(true)
  })
})
