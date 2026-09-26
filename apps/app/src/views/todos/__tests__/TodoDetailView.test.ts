import { describe, it, expect, beforeEach, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, makeTodo } from "@/test/fixtures"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1", projectId: "p1", id: "t1" }, query: {} }),
  useRouter: () => ({ push, back: vi.fn() }),
}))

// `stores/tenant` imports the router singleton at module load, so the real
// module would call `createRouter` against the mocked `vue-router` above.
// vi.mock factories are hoisted above regular top-level statements, so the ref
// has to come from vi.hoisted to exist before the factory runs.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1", projectId: "p1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { request } from "@/utils/http"
import TodoDetailView from "../TodoDetailView.vue"

describe("TodoDetailView", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(request.get).mockResolvedValue(ok(makeTodo({ id: "t1", title: "Write the spec" })))
  })

  it("renders one table row per field", async () => {
    const wrapper = mount(TodoDetailView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))
    expect(wrapper.findAll("tbody tr")).toHaveLength(5)
    expect(wrapper.find("code").text()).toBe("t1")
  })

  it("shows the not-found state when the fetch fails", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("404"))
    const wrapper = mount(TodoDetailView, { global: { plugins: [createPinia()] } })
    // The view renders the not-found state before the fetch starts. Wait for the fetch to end.
    await vi.waitFor(() => expect(request.get).toHaveBeenCalled())
    await flushPromises()
    expect(wrapper.text()).toContain("Todo not found")
    const back = wrapper.findAll("button").find((b) => b.text() === "Back to Todos")
    await back?.trigger("click")
    expect(push).toHaveBeenCalledWith("/orgs/o1/projects/p1")
  })
})
