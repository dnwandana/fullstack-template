import { describe, expect, it, vi } from "vitest"
import { flushPromises, mount } from "@vue/test-utils"
import InviteLinkDialog from "../InviteLinkDialog.vue"

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LINK = "https://app.example.com/invite/inv1?token=abc"

describe("InviteLinkDialog", () => {
  it("shows the title, the description and the link with no footer, and emits close", async () => {
    const wrapper = mount(InviteLinkDialog, {
      attachTo: document.body,
      props: { open: true, url: LINK },
    })
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.querySelector("[data-slot=dialog-title]")?.textContent?.trim()).toBe(
      "New invitation link",
    )
    const describedBy = dialog?.getAttribute("aria-describedby")
    expect(document.getElementById(describedBy ?? "")?.textContent?.trim()).toBe(
      "Copy this link and send it to the invitee. It is shown once.",
    )
    expect(
      dialog?.querySelector<HTMLInputElement>('input[aria-label="Invitation link"]')?.value,
    ).toBe(LINK)
    expect(dialog?.querySelector("[data-slot=dialog-footer]")).toBeNull()
    Array.from(document.body.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Close")
      ?.click()
    await flushPromises()
    expect(wrapper.emitted("close")).toHaveLength(1)
    wrapper.unmount()
  })
})
