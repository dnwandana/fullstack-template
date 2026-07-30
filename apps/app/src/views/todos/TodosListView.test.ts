import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { isRef } from "vue"
import { ok, okPaginated, makeRole, makeTodo } from "@/test/fixtures"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { orgId: "o1", projectId: "p1" }, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
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

import { Table } from "ant-design-vue"
import { request } from "@/utils/http"
import TodosListView from "./TodosListView.vue"

describe("TodosListView", () => {
  // jsdom does not implement matchMedia; Ant Design Vue's table subscribes to it on mount.
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
    vi.mocked(request.get).mockImplementation((url: string) => {
      if (url.includes("/todos")) {
        return Promise.resolve(okPaginated([makeTodo({ id: "t1", title: "Write the spec" })]))
      }
      return Promise.resolve(ok([makeRole()]))
    })
  })

  it("hands AntD a plain array of keys, not a ref", async () => {
    const wrapper = mount(TodosListView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))

    const selection = wrapper.findComponent(Table).props("rowSelection")
    // `props()` types every prop as possibly-undefined. Narrow with a throw
    // rather than a non-null assertion — the package carries none.
    if (!selection) throw new Error("Table rendered without a rowSelection prop")

    // A ref IS an object, so an Array.isArray check alone would pass against the
    // pre-migration plain-object form. `isRef` is the assertion that catches it.
    expect(isRef(selection.selectedRowKeys)).toBe(false)
    expect(Array.isArray(selection.selectedRowKeys)).toBe(true)
    expect(typeof selection.onChange).toBe("function")
  })

  it("records the selection AntD reports back", async () => {
    const wrapper = mount(TodosListView, { global: { plugins: [createPinia()] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))

    const table = wrapper.findComponent(Table)
    const selection = table.props("rowSelection")
    if (!selection?.onChange) throw new Error("Table rendered without a rowSelection handler")

    // AntD declares `onChange(selectedRowKeys, selectedRows)`; the view's
    // `handleSelectionChange` reads only the first, so the rows array is empty.
    selection.onChange(["t1"], [])
    await wrapper.vm.$nextTick()

    const updated = table.props("rowSelection")
    if (!updated) throw new Error("Table rendered without a rowSelection prop")
    expect(updated.selectedRowKeys).toEqual(["t1"])
  })
})
