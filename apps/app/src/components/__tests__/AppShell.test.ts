import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"
import { ok, okPaginated, makeOrg, makeOrgMember, makePermission, makeRole } from "@/test/fixtures"

// vi.mock factories are hoisted above regular top-level statements, so a
// plain `const route = ref(...)` here would still be in its TDZ when the
// mock factory runs. vi.hoisted is *also* hoisted, and awaiting it lets the
// ref exist before anything else in the file executes.
const { route } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { route: ref({ params: { orgId: "o1" }, name: "ProjectsList", matched: [] }) }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  useRouter: () => ({ push: vi.fn() }),
  RouterView: { name: "RouterView", template: "<div class='rv' />" },
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: {
    get: vi.fn(),
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

import AppShell from "../AppShell.vue"
import { request } from "@/utils/http"
import { useTenantStore } from "@/stores/tenant"
import { useAuthStore } from "@/stores/auth"

const MOBILE = "(max-width: 767px)"
const NARROW = "(min-width: 768px) and (max-width: 991px)"

/**
 * jsdom has no matchMedia; antd's grid subscribes to it on mount.
 *
 * @param matching - media query strings that should report matches
 */
function stubMatchMedia(matching: string[] = []): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matching.includes(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe("AppShell", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    stubMatchMedia()
    // The default the mock factory used to carry inline. It cannot live in the
    // factory any more: `ok` is an ordinary import, and vi.mock factories are
    // hoisted above imports.
    vi.mocked(request.get).mockReset().mockResolvedValue(ok([]))
  })

  it("renders the top bar, breadcrumb, nav and the routed view", () => {
    const wrapper = mount(AppShell)
    expect(wrapper.findComponent({ name: "TopBar" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "AppBreadcrumb" }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: "SideNav" }).exists()).toBe(true)
    expect(wrapper.find(".rv").exists()).toBe(true)
  })

  it("starts expanded on a wide viewport", () => {
    expect(mount(AppShell).vm.collapsed).toBe(false)
  })

  it("restores the persisted collapse preference", () => {
    localStorage.setItem("shell.collapsed", "true")
    expect(mount(AppShell).vm.collapsed).toBe(true)
  })

  it("persists the preference when toggled", async () => {
    const wrapper = mount(AppShell)
    wrapper.vm.toggleCollapsed()
    await wrapper.vm.$nextTick()
    expect(localStorage.getItem("shell.collapsed")).toBe("true")
  })

  it("forces the rail on a narrow viewport without overwriting the preference", () => {
    stubMatchMedia([NARROW])
    const wrapper = mount(AppShell)
    expect(wrapper.vm.collapsed).toBe(true)
    expect(localStorage.getItem("shell.collapsed")).toBeNull()
  })

  it("swaps the sider for a drawer below 768px", () => {
    stubMatchMedia([MOBILE])
    const wrapper = mount(AppShell)
    expect(wrapper.find(".app-shell__sider").exists()).toBe(false)
    expect(wrapper.findComponent({ name: "ADrawer" }).exists()).toBe(true)
  })

  it("loads the org list on mount so a deep link resolves the org switcher/breadcrumb", async () => {
    // Regression for: nothing populated orgsStore.orgs, so opening a deep
    // link straight into an org (no visit to /orgs first) left the switcher
    // and breadcrumb with no org name to show.
    route.value = { params: { orgId: "o1" }, name: "OrgMembers", matched: [] }
    vi.mocked(request.get).mockImplementation((url: string) => {
      if (url === "/orgs") return Promise.resolve(ok([makeOrg({ id: "o1", name: "Acme" })]))
      return Promise.resolve(ok([]))
    })

    const wrapper = mount(AppShell)
    await flushPromises()

    expect(wrapper.text()).toContain("Acme")
  })

  it("re-resolves permissions after an invalidation so the nav does not blank", async () => {
    // Regression for: a role edit (or a self role change) calls
    // tenant.invalidatePermissions(orgId), which deletes the cached set. The
    // routed view stays mounted and never re-loads, so SideNav's can() and the
    // views' gated buttons went blank until the next navigation. The shell now
    // owns re-resolution by watching permissionsReady.
    route.value = { params: { orgId: "o1" }, name: "OrgRoles", matched: [] }
    const auth = useAuthStore()
    auth.user = { id: "u1", name: "Dev", email: "dev@example.com" }
    vi.mocked(request.get).mockImplementation((url: string) => {
      if (url === "/orgs") return Promise.resolve(ok([makeOrg({ id: "o1", name: "Acme" })]))
      if (url.endsWith("/members"))
        return Promise.resolve(
          okPaginated([makeOrgMember({ user_id: "u1", role_id: "r1", role_name: "owner" })]),
        )
      if (url.includes("/roles/"))
        return Promise.resolve(
          ok(
            makeRole({
              permissions: [
                makePermission({
                  name: "org:manage_roles",
                  resource: "org",
                  action: "manage_roles",
                }),
              ],
            }),
          ),
        )
      return Promise.resolve(ok([]))
    })

    mount(AppShell)
    const tenant = useTenantStore()
    await flushPromises()
    expect(tenant.permissions.o1).toEqual(["org:manage_roles"])

    tenant.invalidatePermissions("o1")
    expect(tenant.permissions).not.toHaveProperty("o1")

    await flushPromises()
    expect(tenant.permissions.o1).toEqual(["org:manage_roles"])
  })
})
