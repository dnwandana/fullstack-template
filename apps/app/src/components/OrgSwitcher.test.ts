import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

const { route } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  // `orgId` is optional because the "renders nothing when no org is selected"
  // case reassigns the ref to an empty params object.
  const route = ref<{ params: { orgId?: string } }>({ params: { orgId: "o1" } })
  return { route }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))
vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import OrgSwitcher from "./OrgSwitcher.vue"
import { useTenantStore } from "@/stores/tenant"
import { useOrgsStore } from "@/stores/orgs"

const ORGS = [
  {
    id: "o1",
    name: "Acme",
    description: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "o2",
    name: "Globex",
    description: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

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

  beforeEach(() => setActivePinia(createPinia()))

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
})
