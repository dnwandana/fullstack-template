import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

// vi.mock factories are hoisted above regular top-level statements, so a plain
// `const route = ref(...)` here would still be in its TDZ when the mock
// factory runs. vi.hoisted is *also* hoisted, and awaiting it lets the ref
// exist before anything else in the file executes. See stores/tenant.test.js.
const { route } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { route: ref({ params: { orgId: "o1", projectId: "p1" }, name: "TodosList" }) }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    send: vi.fn(),
  },
}))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import TopBar from "./TopBar.vue"

function mountAt(params) {
  setActivePinia(createPinia())
  route.value = { params, name: "TodosList" }
  return mount(TopBar)
}

describe("TopBar", () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("renders the switchers, the bell and the user menu", () => {
    const wrapper = mountAt({ orgId: "o1", projectId: "p1" })
    expect(wrapper.findComponent({ name: "OrgSwitcher" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "ProjectSwitcher" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "InvitationsBell" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "UserMenu" }).exists()).toBe(true)
  })

  it("shows the separator when a project is selected", () => {
    expect(mountAt({ orgId: "o1", projectId: "p1" }).find(".top-bar__sep").exists()).toBe(true)
  })

  it("hides the separator when no project is selected", () => {
    expect(mountAt({ orgId: "o1" }).find(".top-bar__sep").exists()).toBe(false)
  })

  it("emits toggle-drawer when the hamburger is clicked", async () => {
    const wrapper = mountAt({ orgId: "o1", projectId: "p1" })
    await wrapper.find(".top-bar__hamburger").trigger("click")
    expect(wrapper.emitted("toggle-drawer")).toHaveLength(1)
  })

  it("links a home/brand icon back to the orgs list", () => {
    // Regression: with no logo/home link, and SideNav starting at Projects
    // plus AppBreadcrumb rooting at the org, /orgs was unreachable from
    // inside the shell without the browser back button.
    const wrapper = mountAt({ orgId: "o1", projectId: "p1" })
    const brand = wrapper.findComponent(".top-bar__brand")
    expect(brand.exists()).toBe(true)
    expect(brand.props("to")).toEqual({ name: "OrgsList" })
  })
})
