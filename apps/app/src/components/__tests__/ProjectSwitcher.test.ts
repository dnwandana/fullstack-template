import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { nextTick } from "vue"
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const route = ref(...)` here would still be in its TDZ when the
// mock factory below runs. vi.hoisted is *also* hoisted, and awaiting it lets
// the ref exist before anything else in the file executes.
//
// This has to be a real ref, not a plain `{ value: ... }` object: tenant's
// `currentOrgId` is a computed over `router.currentRoute`, and a computed
// only re-evaluates when its dependency is itself reactive. A plain object
// gives the computed nothing to track, so ProjectSwitcher's
// `watch(() => tenant.currentOrgId, ...)` would never re-fire on reassignment
// — only its `immediate` call would ever run, leaving the org-change path
// (the entire reason the watcher exists) untested.
const { route, push } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  const route = ref<{ params: { orgId: string; projectId?: string } }>({
    params: { orgId: "o1", projectId: "p1" },
  })
  return { route, push: vi.fn() }
})

vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push }),
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import ProjectSwitcher from "../ProjectSwitcher.vue"
import { useProjectsStore } from "@/stores/projects"

const PROJECTS = [
  {
    id: "p1",
    org_id: "o1",
    name: "Website",
    description: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "p2",
    org_id: "o1",
    name: "Mobile",
    description: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

function setup(params: { orgId: string; projectId?: string } = { orgId: "o1", projectId: "p1" }) {
  setActivePinia(createPinia())
  route.value = { params }
  push.mockReset()
  const projects = useProjectsStore()
  projects.projects = PROJECTS
  return { projects }
}

describe("ProjectSwitcher", () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ""
  })
  // Hooks run in reverse order, so this unmount runs before the body is cleared. Each setup()
  // changes the shared route, and a wrapper that is still mounted then patches its portal.
  enableAutoUnmount(afterEach)

  it("shows the current project name", () => {
    setup()
    const wrapper = mount(ProjectSwitcher)
    expect(wrapper.text()).toContain("Website")
  })

  it("renders nothing when no project is selected", () => {
    setup({ orgId: "o1" })
    const wrapper = mount(ProjectSwitcher)
    expect(wrapper.find(".project-switcher").exists()).toBe(false)
  })

  it("navigates to the picked project's todo list", () => {
    setup()
    const wrapper = mount(ProjectSwitcher)
    wrapper.vm.selectProject("p2")
    expect(push).toHaveBeenCalledWith({
      name: "TodosList",
      params: { orgId: "o1", projectId: "p2" },
    })
  })

  it("does not navigate when the current project is picked again", () => {
    setup()
    const wrapper = mount(ProjectSwitcher)
    wrapper.vm.selectProject("p1")
    expect(push).not.toHaveBeenCalled()
  })

  it("re-fetches projects when the org changes while the shell stays mounted", async () => {
    const { projects } = setup()
    const fetchSpy = vi.spyOn(projects, "fetchProjects").mockResolvedValue(undefined)

    mount(ProjectSwitcher)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith("o1")

    // The shell never unmounts across an org switch, so the watcher — not a
    // fresh mount — is what has to pick this up.
    route.value = { params: { orgId: "o2", projectId: "p1" } }
    await nextTick()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledWith("o2")
  })

  it("truncates the name at 88 px below md", () => {
    setup()
    const name = mount(ProjectSwitcher).find('[data-slot="project-name"]')
    expect(name.classes()).toEqual(expect.arrayContaining(["max-w-[88px]", "md:max-w-[160px]"]))
  })

  it("opens a 240 px menu with a check on the current project", async () => {
    setup()
    const wrapper = mount(ProjectSwitcher, { attachTo: document.body })
    await wrapper.find(".project-switcher").trigger("keydown", { key: "Enter" })
    await flushPromises()

    const menu = document.body.querySelector('[data-slot="project-menu"]')
    expect(menu?.className).toContain("w-[240px]")
    const items = document.body.querySelectorAll('[data-slot="project-item"]')
    expect(items[0]?.getAttribute("data-current")).toBe("true")
    expect(items[0]?.querySelector("svg")).not.toBeNull()
    expect(items[0]?.className).toContain("font-medium")
    expect(items[1]?.getAttribute("data-current")).toBe("false")
  })
})
