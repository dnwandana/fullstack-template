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
import TodoFormModal from "@/components/TodoFormModal.vue"

async function mountView() {
  const wrapper = mount(TodoDetailView, { global: { plugins: [createPinia()] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))
  return wrapper
}

describe("TodoDetailView", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(request.get).mockResolvedValue(ok(makeTodo({ id: "t1", title: "Write the spec" })))
  })

  it("renders one field row per field in an 880 px card", async () => {
    const wrapper = await mountView()
    expect(wrapper.classes()).toContain("max-w-[880px]")
    const rows = wrapper.findAll('[data-slot="todo-field"]')
    expect(rows.map((row) => row.find("div").text())).toEqual([
      "Status",
      "Description",
      "Created At",
      "Updated At",
      "ID",
    ])
    expect(rows[0]?.classes()).toEqual(
      expect.arrayContaining([
        "grid-cols-1",
        "md:grid-cols-[140px_minmax(0,1fr)]",
        "last:border-b-0",
      ]),
    )
    expect(rows[0]?.find("div").classes()).toEqual(
      expect.arrayContaining(["text-[13px]", "font-medium", "text-muted-foreground"]),
    )
    const code = wrapper.find("code")
    expect(code.text()).toBe("t1")
    expect(code.classes()).toEqual(expect.arrayContaining(["border", "font-mono", "text-[12px]"]))
  })

  it("keeps Back, Edit and Delete on one row", async () => {
    const actions = (await mountView()).find('[data-slot="todo-actions"]')
    expect(actions.classes()).toContain("justify-between")
    expect(actions.classes()).not.toContain("flex-wrap")
  })

  it("keeps the page visible and passes saving to the dialog during a save", async () => {
    vi.mocked(request.post).mockReturnValue(new Promise(() => {}))
    const wrapper = await mountView()
    wrapper.findComponent(TodoFormModal).vm.$emit("submit", { title: "Ship the spec" })
    await flushPromises()
    expect(wrapper.find("h1").text()).toBe("Write the spec")
    expect(wrapper.findComponent(TodoFormModal).props("loading")).toBe(true)
  })

  it("shows the saved title after a save", async () => {
    vi.mocked(request.post).mockResolvedValue(ok(makeTodo({ id: "t1", title: "Ship the spec" })))
    const wrapper = await mountView()
    vi.mocked(request.get).mockResolvedValue(ok(makeTodo({ id: "t1", title: "Ship the spec" })))
    wrapper.findComponent(TodoFormModal).vm.$emit("submit", { title: "Ship the spec" })
    await vi.waitFor(() => expect(wrapper.find("h1").text()).toBe("Ship the spec"))
    expect(wrapper.findComponent(TodoFormModal).props("loading")).toBe(false)
  })

  it("shows the not-found state when the fetch fails", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("404"))
    const wrapper = mount(TodoDetailView, { global: { plugins: [createPinia()] } })
    // The view renders the not-found state before the fetch starts. Wait for the fetch to end.
    await vi.waitFor(() => expect(request.get).toHaveBeenCalled())
    await flushPromises()
    expect(wrapper.text()).toContain("Todo not found")
    const back = wrapper.findAll("button").find((b) => b.text() === "Back to Todos")
    expect(back?.classes()).toContain("border-input")
    expect(back?.find("svg.lucide-arrow-left").exists()).toBe(true)
    await back?.trigger("click")
    expect(push).toHaveBeenCalledWith("/orgs/o1/projects/p1")
  })
})
