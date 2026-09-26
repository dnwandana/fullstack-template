import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

const push = vi.fn()
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import UserMenu from "../UserMenu.vue"
import { useAuthStore } from "@/stores/auth"

describe("UserMenu", () => {
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
    auth.user = { id: "u1", name: "Ada", email: "ada@example.com" }

    let resolveLogout: (() => void) | undefined
    auth.logout = vi.fn(() => new Promise<void>((r) => (resolveLogout = r)))

    const wrapper = mount(UserMenu)
    const pending = wrapper.vm.handleLogout()

    // Logout is still in flight — navigation must not have happened yet.
    expect(push).not.toHaveBeenCalled()

    resolveLogout?.()
    await pending
    expect(push).toHaveBeenCalledWith({ name: "Login" })
  })

  it("renders nothing when there is no signed-in user", () => {
    const wrapper = mount(UserMenu)
    expect(wrapper.find(".user-menu").exists()).toBe(false)
  })
})
