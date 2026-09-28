import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
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

  afterEach(() => {
    document.body.innerHTML = ""
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

  it("shows a round avatar and hides the name below sm", () => {
    useAuthStore().user = { id: "u1", name: "Ada Lovelace", email: "ada@example.com" }
    const wrapper = mount(UserMenu)
    const avatar = wrapper.find('.user-menu [data-slot="user-avatar"]')
    expect(avatar.text()).toBe("A")
    expect(avatar.classes()).toContain("rounded-full")
    expect(wrapper.find(".user-menu").classes()).toContain("max-sm:rounded-full")
    expect(wrapper.find('.user-menu [data-slot="user-trigger-name"]').classes()).toEqual(
      expect.arrayContaining(["hidden", "sm:inline"]),
    )
  })

  it("opens a 240 px menu with the name in weight 600 over the email", async () => {
    useAuthStore().user = { id: "u1", name: "Ada Lovelace", email: "ada@example.com" }
    const wrapper = mount(UserMenu, { attachTo: document.body })
    await wrapper.find(".user-menu").trigger("keydown", { key: "Enter" })
    await flushPromises()

    expect(document.body.querySelector('[data-slot="user-menu"]')?.className).toContain("w-[240px]")
    const name = document.body.querySelector('[data-slot="user-name"]')
    expect(name?.textContent).toBe("Ada Lovelace")
    expect(name?.className).toContain("font-semibold")
    expect(document.body.textContent).toContain("ada@example.com")
  })

  async function openThemeMenu() {
    useAuthStore().user = { id: "u1", name: "Ada", email: "ada@example.com" }
    const wrapper = mount(UserMenu, { attachTo: document.body })
    await wrapper.find(".user-menu").trigger("keydown", { key: "Enter" })
    await flushPromises()
    const trigger = document.body.querySelector('[data-slot="theme-trigger"]')
    trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flushPromises()
    return trigger
  }

  it("offers System, Light and Dark in a Theme submenu", async () => {
    const trigger = await openThemeMenu()
    expect(trigger?.textContent).toContain("Theme")
    const items = document.body.querySelectorAll('[role="menuitemradio"]')
    expect(Array.from(items, (item) => item.textContent?.trim())).toEqual([
      "System",
      "Light",
      "Dark",
    ])
  })

  it("checks System when nothing is stored", async () => {
    localStorage.removeItem("ui.theme")
    await openThemeMenu()
    const checked = document.body.querySelector('[role="menuitemradio"][aria-checked="true"]')
    expect(checked?.textContent?.trim()).toBe("System")
  })
})
