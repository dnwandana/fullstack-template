import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

const { route } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { route: ref({ params: { orgId: "o1" }, matched: [{ name: "OrgMembers" }] }) }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))

import SideNav from "./SideNav.vue"
import { useTenantStore } from "@/stores/tenant"

function mountWith(permissions, params = { orgId: "o1" }) {
  setActivePinia(createPinia())
  route.value = { params, matched: [{ name: "OrgMembers" }] }
  const tenant = useTenantStore()
  tenant.permissions = { o1: permissions }
  return mount(SideNav, { global: { plugins: [] } })
}

describe("SideNav", () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("shows the org group when an org is selected and no project is", () => {
    const wrapper = mountWith(["org:read", "org:update", "invitations:manage", "project:read"])
    const text = wrapper.text()
    expect(text).toContain("Projects")
    expect(text).toContain("Members")
    expect(text).toContain("Roles")
    expect(text).toContain("Invitations")
    expect(text).toContain("Settings")
    expect(text).not.toContain("Todos")
  })

  it("hides Settings and Invitations from a role that lacks them", () => {
    const wrapper = mountWith(["org:read", "project:read"])
    const text = wrapper.text()
    expect(text).toContain("Members")
    expect(text).toContain("Roles")
    expect(text).not.toContain("Settings")
    expect(text).not.toContain("Invitations")
  })

  it("switches to the project group when a project is selected", () => {
    const wrapper = mountWith(["todos:read", "project:read", "project:update"], {
      orgId: "o1",
      projectId: "p1",
    })
    const text = wrapper.text()
    expect(text).toContain("Todos")
    expect(text).toContain("Members")
    expect(text).not.toContain("Roles")
  })

  it("renders nothing when no org is selected", () => {
    const wrapper = mountWith(["org:read"], {})
    expect(wrapper.find("nav").exists()).toBe(false)
  })

  it("marks the matched route as selected", () => {
    const wrapper = mountWith(["org:read"])
    expect(wrapper.vm.selectedKeys).toEqual(["OrgMembers"])
  })

  it("keeps Todos highlighted on the flat TodoDetail route", () => {
    // Regression: TodoDetail has no nav item of its own, and the routes are
    // flat, so it used to fall out of `route.matched` entirely and clear the
    // Todos highlight while viewing a single todo.
    setActivePinia(createPinia())
    const params = { orgId: "o1", projectId: "p1", id: "t1" }
    route.value = { params, matched: [{ name: "TodoDetail" }] }
    const tenant = useTenantStore()
    tenant.permissions = { o1: ["todos:read", "project:read"] }

    const wrapper = mount(SideNav)
    expect(wrapper.vm.selectedKeys).toEqual(["TodosList"])
    expect(wrapper.find(".ant-menu-item-selected").text()).toBe("Todos")
  })
})
