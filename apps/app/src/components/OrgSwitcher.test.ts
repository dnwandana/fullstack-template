import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

// `push` is hoisted alongside `route` so one spy survives every `useRouter()`
// call. The component calls `useRouter()` once at setup and keeps that
// instance, so a `vi.fn()` created inline in the factory would hand the test a
// different spy than the one the component pushes to.
const { route, push } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  // `orgId` is optional because the "renders nothing when no org is selected"
  // case reassigns the ref to an empty params object.
  const route = ref<{ params: { orgId?: string } }>({ params: { orgId: "o1" } })
  return { route, push: vi.fn() }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push }),
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))
vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import { Menu } from "ant-design-vue"
import OrgSwitcher from "./OrgSwitcher.vue"
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
    // One spy is shared across every `useRouter()` call, so without this the
    // no-navigation case would see the previous test's push.
    push.mockReset()
  })

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
    tenant.orgMeta = { o2: { memberCount: 3, roleId: "r1", roleName: "admin" } }
    expect(wrapper.vm.metaFor("o2")).toEqual({
      memberCount: 3,
      roleId: "r1",
      roleName: "admin",
    })
  })

  // `selectOrg` is not in `defineExpose`, so both cases drive it through the
  // Menu's `@click` handler — the component's own contract.
  it("navigates to the chosen org's projects", async () => {
    setup()
    const wrapper = mount(OrgSwitcher)
    await wrapper.vm.onOpenChange(true)

    await wrapper.findComponent(Menu).vm.$emit("click", { key: "o2" })

    expect(push).toHaveBeenCalledWith({ name: "ProjectsList", params: { orgId: "o2" } })
  })

  it("does not navigate when the chosen org is already current", async () => {
    setup() // route.params.orgId is "o1"
    const wrapper = mount(OrgSwitcher)
    await wrapper.vm.onOpenChange(true)

    await wrapper.findComponent(Menu).vm.$emit("click", { key: "o1" })

    expect(push).not.toHaveBeenCalled()
  })
})
