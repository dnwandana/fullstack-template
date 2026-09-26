import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
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

function setup(permissionNames: string[]) {
  setActivePinia(createPinia())
  useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
  vi.mocked(request.get)
    .mockReset()
    .mockImplementation((url: string) => {
      if (url === "/orgs/o1") return Promise.resolve(ok(makeOrg()))
      if (url === "/orgs/o1/projects") return Promise.resolve(ok([makeProject()]))
      if (url.endsWith("/members"))
        return Promise.resolve(okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1" })]))
      if (url.includes("/roles/"))
        return Promise.resolve(
          ok(makeRole({ permissions: permissionNames.map((name) => makePermission({ name })) })),
        )
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  return mount(ProjectsListView)
}

describe("ProjectsListView", () => {
  beforeEach(() => push.mockReset())

  it("renders a card for each project under the organization name", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.text()).toContain("Apollo"))
    expect(wrapper.findAll("div.bg-card")).toHaveLength(1)
    await vi.waitFor(() => expect(wrapper.find("h1").text()).toBe("Acme"))
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

  it("pushes the todos route from View Todos", async () => {
    const wrapper = setup([])
    await vi.waitFor(() => expect(wrapper.text()).toContain("Apollo"))
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "View Todos")
      ?.trigger("click")
    expect(push).toHaveBeenCalledWith("/orgs/o1/projects/p1")
  })
})
