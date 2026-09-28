import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { enableAutoUnmount, mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

// `push` is hoisted alongside `route` so one spy survives every `useRouter()`
// call. The component calls `useRouter()` once at setup and keeps that
// instance, so a `vi.fn()` created inline in the factory would hand the test a
// different spy than the one the component pushes to.
const { route, push } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  // `orgId` is optional because the "renders nothing when no org is selected"
  // case reassigns the ref to an empty params object.
  const route = ref<{ params: { orgId?: string; projectId?: string } }>({ params: { orgId: "o1" } })
  return { route, push: vi.fn() }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push }),
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ChevronsUpDown } from "@lucide/vue"
import OrgSwitcher from "../OrgSwitcher.vue"
import { useTenantStore } from "@/stores/tenant"
import { useOrgsStore } from "@/stores/orgs"
import { makeOrg } from "@/test/fixtures"

const ORGS = [makeOrg({ id: "o1", name: "Acme" }), makeOrg({ id: "o2", name: "Globex" })]

function setup() {
  setActivePinia(createPinia())
  route.value = { params: { orgId: "o1" } }
  const orgs = useOrgsStore()
  orgs.orgs = ORGS
  const tenant = useTenantStore()
  tenant.loadAllOrgMeta = vi.fn().mockResolvedValue(undefined)
  return { tenant, orgs }
}

describe("OrgSwitcher", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // One spy is shared across every `useRouter()` call, so without this the
    // no-navigation case would see the previous test's push.
    push.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })
  // Hooks run in reverse order, so this unmount runs before the body is cleared. Several tests
  // open the menu, and its portal stays in the body until the wrapper unmounts.
  enableAutoUnmount(afterEach)

  it("shows the current org name", () => {
    setup()
    const wrapper = mount(OrgSwitcher)
    expect(wrapper.text()).toContain("Acme")
  })

  it("renders nothing when no org is selected", () => {
    setup()
    route.value = { params: {} }
    const wrapper = mount(OrgSwitcher)
    expect(wrapper.find(".org-switcher").exists()).toBe(false)
  })

  it("loads org metadata on first open only", async () => {
    const { tenant } = setup()
    const wrapper = mount(OrgSwitcher)
    await wrapper.vm.onOpenChange(true)
    await wrapper.vm.onOpenChange(false)
    await wrapper.vm.onOpenChange(true)
    expect(tenant.loadAllOrgMeta).toHaveBeenCalledTimes(1)
  })

  it("reports metadata as pending until the org has an entry", async () => {
    const { tenant } = setup()
    const wrapper = mount(OrgSwitcher)
    expect(wrapper.vm.metaFor("o2")).toBeNull()
    tenant.orgMeta = { o2: { memberCount: 3, roleId: "r1", roleName: "admin", failed: false } }
    expect(wrapper.vm.metaFor("o2")).toEqual({
      memberCount: 3,
      roleId: "r1",
      roleName: "admin",
      failed: false,
    })
  })

  // Both cases call the exposed `selectOrg`. The dropdown items render in a
  // portal, so the test does not click them.
  it("navigates to the chosen org's projects", async () => {
    setup()
    const wrapper = mount(OrgSwitcher)
    await wrapper.vm.onOpenChange(true)

    wrapper.vm.selectOrg("o2")

    expect(push).toHaveBeenCalledWith({ name: "ProjectsList", params: { orgId: "o2" } })
  })

  it("does not navigate when the chosen org is already current", async () => {
    setup() // route.params.orgId is "o1"
    const wrapper = mount(OrgSwitcher)
    await wrapper.vm.onOpenChange(true)

    wrapper.vm.selectOrg("o1")

    expect(push).not.toHaveBeenCalled()
  })

  it("shows a 20 px square org avatar and the up-down chevron", () => {
    setup()
    const wrapper = mount(OrgSwitcher)
    const avatar = wrapper.find('.org-switcher [data-slot="user-avatar"]')
    expect(avatar.classes()).toEqual(expect.arrayContaining(["rounded-md", "size-5"]))
    expect(wrapper.findComponent(ChevronsUpDown).exists()).toBe(true)
  })

  it("hides the org name below md only when a project is open", () => {
    setup()
    expect(mount(OrgSwitcher).find('[data-slot="org-name"]').classes()).not.toContain("hidden")
    route.value = { params: { orgId: "o1", projectId: "p1" } }
    const wrapper = mount(OrgSwitcher)
    const name = wrapper.find('[data-slot="org-name"]')
    expect(name.classes()).toEqual(expect.arrayContaining(["hidden", "md:inline"]))
    expect(wrapper.find(".org-switcher").attributes("aria-label")).toBe("Organization: Acme")
  })

  it("marks the current org and shows the count, or '-' for a failed org", async () => {
    const { tenant } = setup()
    tenant.orgMeta = {
      o1: { memberCount: 1, roleId: "r1", roleName: "owner", failed: false },
      o2: { memberCount: 0, roleId: null, roleName: null, failed: true },
    }
    const wrapper = mount(OrgSwitcher, { attachTo: document.body })
    await wrapper.vm.onOpenChange(true)
    await flushPromises()

    expect(document.body.querySelector('[data-slot="org-menu"]')?.className).toContain("w-[300px]")
    const items = document.body.querySelectorAll('[data-slot="org-item"]')
    expect(items[0]?.getAttribute("data-current")).toBe("true")
    expect(items[0]?.textContent).toContain("1 member")
    expect(items[0]?.textContent).not.toContain("1 members")
    expect(items[1]?.getAttribute("data-current")).toBe("false")
    expect(items[1]?.querySelector('[data-slot="org-meta"]')?.textContent?.trim()).toBe("-")
  })
})
