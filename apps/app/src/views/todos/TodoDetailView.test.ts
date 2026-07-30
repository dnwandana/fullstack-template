import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, makeTodo } from "@/test/fixtures"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1", projectId: "p1", id: "t1" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
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

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import { request } from "@/utils/http"
import TodoDetailView from "./TodoDetailView.vue"

describe("TodoDetailView", () => {
  // jsdom does not implement matchMedia; Ant Design Vue's grid subscribes to it on mount.
  beforeAll(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(request.get).mockResolvedValue(ok(makeTodo({ id: "t1", title: "Write the spec" })))
  })

  it("renders the detail grid one column per row", async () => {
    const wrapper = mount(TodoDetailView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))

    // AntD renders one <tr> per row of the grid. Five items at one column each
    // means five rows; the default of three would give two.
    expect(wrapper.findAll(".ant-descriptions-row")).toHaveLength(5)
  })
})
