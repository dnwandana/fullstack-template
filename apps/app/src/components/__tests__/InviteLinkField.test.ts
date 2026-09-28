import { afterEach, describe, expect, it, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
import { toast } from "vue-sonner"
import InviteLinkField from "../InviteLinkField.vue"

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LINK = "https://app.example.com/invite/inv1?token=abc"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("InviteLinkField", () => {
  it("shows the link in a read-only mono input beside a 36 px copy button", () => {
    const wrapper = mount(InviteLinkField, { props: { url: LINK } })
    const input = wrapper.find("input")
    expect(input.element.value).toBe(LINK)
    expect(input.attributes("readonly")).toBeDefined()
    expect(input.classes()).toEqual(
      expect.arrayContaining(["font-mono", "text-[12px]", "min-w-0", "flex-1"]),
    )
    const button = wrapper.find('button[aria-label="Copy link"]')
    expect(button.classes()).toEqual(expect.arrayContaining(["size-9", "border-input"]))
    expect(button.find("svg.lucide-copy").exists()).toBe(true)
  })

  it("keeps the link visible and selects it on focus when the browser has no clipboard", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined })
    const wrapper = mount(InviteLinkField, { props: { url: LINK }, attachTo: document.body })
    await wrapper.find('button[aria-label="Copy link"]').trigger("click")
    await flushPromises()
    expect(toast.error).toHaveBeenCalledWith("Copy failed. Select the link and copy it by hand.")
    const input = wrapper.find("input")
    await input.trigger("focus")
    expect(input.element.value).toBe(LINK)
    expect(input.element.selectionStart).toBe(0)
    expect(input.element.selectionEnd).toBe(LINK.length)
    wrapper.unmount()
  })
})
