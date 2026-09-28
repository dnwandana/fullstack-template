import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import {
  ok,
  okPaginated,
  makeOrg,
  makeOrgMember,
  makePermission,
  makeProject,
  makeRole,
} from "@/test/fixtures"
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
  useRoute: () => ({ params: { orgId: "o1" }, query: {} }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import ProjectsListView from "../ProjectsListView.vue"
import { useAuthStore } from "@/stores/auth"

const RouterLinkStub = { props: ["to"], template: '<a :href="String(to)"><slot /></a>' }

function setup(permissionNames: string[], projects = [makeProject()]) {
  setActivePinia(createPinia())
  useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  vi.mocked(request.get)
    .mockReset()
    .mockImplementation((url: string) => {
      if (url === "/orgs/o1") return Promise.resolve(ok(makeOrg()))
      if (url === "/orgs/o1/projects") return Promise.resolve(ok(projects))
      if (url.endsWith("/members"))
        return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
      if (url.includes("/roles/"))
        return Promise.resolve(
          ok(makeRole({ permissions: permissionNames.map((name) => makePermission({ name })) })),
        )
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  return mount(ProjectsListView, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe("ProjectsListView", () => {
  beforeEach(() => push.mockReset())

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders a table row for each project under the organization name", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.text()).toContain("Apollo"))
    const rows = wrapper.findAll('[data-slot="project-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.find('a[href="/orgs/o1/projects/p1"]').text()).toContain("View Todos")
    await vi.waitFor(() => expect(wrapper.find("h1").text()).toBe("Acme"))
  })

  it("opens the todos on a row click and on Enter", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.find('[data-slot="project-row"]').exists()).toBe(true))
    const row = wrapper.find('[data-slot="project-row"]')
    await row.trigger("click")
    await row.trigger("keydown", { key: "Enter" })
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledWith("/orgs/o1/projects/p1")
  })

  // Review Focus 3: the link navigates by itself, so the row must not navigate a second time.
  it("does not navigate from the row for a click or Enter on the link", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.find('[data-slot="project-row"] a').exists()).toBe(true))
    const link = wrapper.find('[data-slot="project-row"] a')
    await link.trigger("click")
    await link.trigger("keydown", { key: "Enter" })
    expect(push).not.toHaveBeenCalled()
  })

  it("shows No description in italic for an empty description", async () => {
    const wrapper = setup([], [makeProject({ description: null })])
    await vi.waitFor(() => expect(wrapper.text()).toContain("No description"))
    expect(wrapper.find('[data-slot="project-desc"]').classes()).toContain("italic")
  })

  it("shows the FolderKanban tile when the org has no projects", async () => {
    const wrapper = setup([], [])
    // The empty state also shows before the mount fetch starts, so wait for the fetch to end.
    await vi.waitFor(() => expect(request.get).toHaveBeenCalledWith("/orgs/o1/projects"))
    await flushPromises()
    expect(wrapper.text()).toContain("No projects yet")
    expect(wrapper.find("svg.lucide-folder-kanban").exists()).toBe(true)
  })

  it("shows Create Project with the project:create permission", async () => {
    const wrapper = setup(["project:create"])
    await vi.waitFor(() => expect(wrapper.text()).toContain("Create Project"))
  })

  it("hides Create Project without the permission", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.text()).toContain("Apollo"))
    expect(wrapper.text()).not.toContain("Create Project")
  })
})
