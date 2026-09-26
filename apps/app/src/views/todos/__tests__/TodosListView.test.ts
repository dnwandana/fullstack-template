import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, okPaginated, makeOrgMember, makePermission, makeRole, makeTodo } from "@/test/fixtures"

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

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { request } from "@/utils/http"
import { useAuthStore } from "@/stores/auth"
import TodosListView from "../TodosListView.vue"

async function mountView() {
  // One pinia for the store setup and the mount, so the view sees the signed-in user.
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  const wrapper = mount(TodosListView, { global: { plugins: [pinia] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))
  return wrapper
}

describe("TodosListView", () => {
  beforeEach(() => {
    vi.mocked(request.get).mockReset().mockImplementation((url: string) => {
      if (url.includes("/todos"))
        return Promise.resolve(okPaginated([makeTodo({ id: "t1", title: "Write the spec" })]))
      if (url.endsWith("/members"))
        return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
      return Promise.resolve(ok(makeRole({ permissions: [makePermission({ name: "todos:delete" })] })))
    })
  })

  it("selects every visible row from the header checkbox", async () => {
    const wrapper = await mountView()
    await wrapper.find('thead [role="checkbox"]').trigger("click")
    expect(wrapper.vm.allSelected).toBe(true)
    expect(wrapper.findAll('tbody tr[data-state="selected"]')).toHaveLength(1)
  })

  it("records a single row selection in the store", async () => {
    const wrapper = await mountView()
    wrapper.vm.toggleOne("t1", true)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.allSelected).toBe(true)
    expect(wrapper.findAll('tbody tr[data-state="selected"]')).toHaveLength(1)
  })

  it("shows the bulk delete button once a row is selected", async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).not.toContain("Delete Selected")
    wrapper.vm.toggleOne("t1", true)
    await vi.waitFor(() => expect(wrapper.text()).toContain("Delete Selected (1)"))
  })

  it("shows the range text for the current page", async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain("1-1 of 1")
  })

  it("refetches page 1 with the new page size", async () => {
    const wrapper = await mountView()
    wrapper.vm.onPageSizeChange("20")
    expect(request.get).toHaveBeenLastCalledWith(
      expect.stringContaining("/todos"),
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })
})
