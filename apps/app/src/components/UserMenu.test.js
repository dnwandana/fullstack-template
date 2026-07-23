import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

const push = vi.fn()
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }))

vi.mock("ant-design-vue", async (importOriginal) => ({
  ...(await importOriginal()),
  message: { success: vi.fn(), error: vi.fn() },
}))

import UserMenu from "./UserMenu.vue"
import { useAuthStore } from "@/stores/auth"

describe("UserMenu", () => {
  // jsdom does not implement matchMedia; Ant Design Vue's grid subscribes to it on mount.
  beforeAll(() => {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
  })

  it("shows the signed-in user's name", () => {
    useAuthStore().user = { id: "u1", name: "Ada Lovelace", email: "ada@example.com" }
    const wrapper = mount(UserMenu)
    expect(wrapper.text()).toContain("Ada Lovelace")
  })

  it("waits for logout to finish before navigating", async () => {
    const auth = useAuthStore()
    auth.user = { id: "u1", name: "Ada" }

    let resolveLogout
    auth.logout = vi.fn(() => new Promise((r) => (resolveLogout = r)))

    const wrapper = mount(UserMenu)
    const pending = wrapper.vm.handleLogout()

    // Logout is still in flight — navigation must not have happened yet.
    expect(push).not.toHaveBeenCalled()

    resolveLogout()
    await pending
    expect(push).toHaveBeenCalledWith({ name: "Login" })
  })

  it("renders nothing when there is no signed-in user", () => {
    const wrapper = mount(UserMenu)
    expect(wrapper.find(".user-menu").exists()).toBe(false)
  })
})
