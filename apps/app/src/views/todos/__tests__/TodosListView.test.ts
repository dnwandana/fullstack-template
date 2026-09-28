import { describe, it, expect, beforeEach, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import type { Todo, Wire } from "@fullstack/contracts"
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
import PageHeader from "@/components/PageHeader.vue"
import TodosListView from "../TodosListView.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"

function mockApi(todos: Wire<Todo>[], permissionNames: string[]) {
  vi.mocked(request.get).mockReset().mockImplementation((url: string) => {
    if (url.includes("/todos")) return Promise.resolve(okPaginated(todos))
    if (url.endsWith("/members"))
      return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
    return Promise.resolve(
      ok(makeRole({ permissions: permissionNames.map((name) => makePermission({ name })) })),
    )
  })
}

function mountBare() {
  // One pinia for the store setup and the mount, so the view sees the signed-in user.
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  return mount(TodosListView, { global: { plugins: [pinia] } })
}

async function mountView() {
  const wrapper = mountBare()
  await vi.waitFor(() => expect(wrapper.text()).toContain("Write the spec"))
  // The permissions load after two requests. Wait for them, because they gate the columns.
  await flushPromises()
  return wrapper
}

describe("TodosListView", () => {
  beforeEach(() => {
    mockApi([makeTodo({ id: "t1", title: "Write the spec" })], ["todos:delete"])
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

  it("renders no checkbox column without todos:delete", async () => {
    mockApi([makeTodo()], [])
    const wrapper = await mountView()
    expect(wrapper.find('[role="checkbox"]').exists()).toBe(false)
    expect(wrapper.findAll("th").map((th) => th.text())).toEqual([
      "Title", "Description", "Status", "Updated", "Actions",
    ])
  })

  it("styles the title, the description and the updated cells", async () => {
    mockApi([makeTodo({ description: "Draft three options" })], ["todos:delete"])
    const cells = (await mountView()).findAll("tbody td")
    expect(cells[1]?.classes()).toContain("font-medium")
    expect(cells[2]?.classes()).toContain("text-muted-foreground")
    expect(cells[4]?.text()).toBe("Jan 1, 2026, 00:00")
    expect(cells[4]?.classes()).toEqual(expect.arrayContaining(["text-muted-foreground", "tabular-nums"]))
    expect(cells[5]?.classes()).toEqual(expect.arrayContaining(["w-[1%]", "text-right"]))
  })

  it("renders a 116 px page-size select", async () => {
    const trigger = (await mountView()).findAll('button[role="combobox"]').at(-1)
    expect(trigger?.classes()).toEqual(expect.arrayContaining(["h-8", "w-[116px]"]))
  })

  it("shows 5 skeleton rows and no pager during the first load", async () => {
    vi.mocked(request.get).mockReturnValue(new Promise(() => {}))
    const wrapper = mountBare()
    await flushPromises()
    expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(5)
    expect(wrapper.text()).not.toContain("of 0")
  })

  it("stacks the toolbar below md: a full-width search, then two half-width selects", async () => {
    const wrapper = await mountView()
    expect(wrapper.findComponent(PageHeader).classes()).toContain(
      "max-md:[&>[data-slot=page-actions]]:w-full",
    )
    expect(wrapper.find('[data-slot="input-group"]').classes()).toEqual(
      expect.arrayContaining(["w-full", "md:w-[250px]"]),
    )
    const [sortBy, order] = wrapper.findAll('button[role="combobox"]')
    expect(sortBy?.classes()).toEqual(expect.arrayContaining(["w-[calc(50%-4px)]", "md:w-[140px]"]))
    expect(order?.classes()).toEqual(expect.arrayContaining(["w-[calc(50%-4px)]", "md:w-[130px]"]))
  })

  it("shows a SquareCheck tile and a Plus icon on Create your first todo", async () => {
    mockApi([], ["todos:create"])
    const wrapper = mountBare()
    await vi.waitFor(() => expect(wrapper.text()).toContain("No todos yet"))
    await flushPromises()
    expect(wrapper.find('[data-slot="empty-icon"] svg.lucide-square-check').exists()).toBe(true)
    const button = wrapper.findAll("button").find((b) => b.text() === "Create your first todo")
    expect(button?.find("svg.lucide-plus").exists()).toBe(true)
  })

  it("shows a Search tile when the search matches nothing", async () => {
    mockApi([], [])
    const wrapper = mountBare()
    await flushPromises()
    const input = wrapper.find('input[placeholder="Search todos..."]')
    await input.setValue("hero banner")
    await input.trigger("keydown.enter")
    await vi.waitFor(() => expect(wrapper.text()).toContain("No todos match your search"))
    expect(wrapper.find('[data-slot="empty-icon"] svg.lucide-search').exists()).toBe(true)
  })
  it("passes the bulk delete to its dialog as an action that rejects on failure", async () => {
    vi.mocked(request.del).mockReset().mockRejectedValue(new Error("409"))
    const wrapper = await mountView()
    wrapper.vm.toggleOne("t1", true)
    await vi.waitFor(() => expect(wrapper.text()).toContain("Delete Selected (1)"))
    const bulk = wrapper
      .findAllComponents(ConfirmDialog)
      .find((dialog) => dialog.props("title") === "Delete 1 selected todo(s)?")
    const action = bulk?.props("action")
    expect(action).toBeTypeOf("function")
    await expect(action?.()).rejects.toThrow("409")
    expect(vi.mocked(request.del).mock.calls[0]?.[1]).toEqual({ ids: "t1" })
  })
})
