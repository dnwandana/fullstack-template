import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia } from "pinia"
import { ok, makeOrg } from "@/test/fixtures"
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

describe("OrgsListView", () => {
  beforeEach(() => {
    push.mockReset()
    vi.mocked(request.get).mockReset()
  })

  it("renders a card per organization with a View Projects link", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([makeOrg(), makeOrg({ id: "o2", name: "Globex" })]))
    const wrapper = mount(OrgsListView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("Globex"))
    expect(wrapper.findAll("div.bg-card")).toHaveLength(2)
    const view = wrapper.findAll("button").filter((b) => b.text() === "View Projects")
    await view[1]?.trigger("click")
    expect(push).toHaveBeenCalledWith("/orgs/o2")
  })

  it("shows the empty state with a create button when there are no orgs", async () => {
    vi.mocked(request.get).mockResolvedValue(ok([]))
    const wrapper = mount(OrgsListView, { global: { plugins: [createPinia()] } })
    // The empty state also shows before the mount fetch starts, so wait for the fetch to end.
    await vi.waitFor(() => expect(request.get).toHaveBeenCalled())
    await flushPromises()
    expect(wrapper.text()).toContain("No organizations yet")
    expect(wrapper.text()).toContain("Create your first organization")
  })
})
