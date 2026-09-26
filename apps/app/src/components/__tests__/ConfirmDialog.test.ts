import { mount, type VueWrapper } from "@vue/test-utils"
import ConfirmDialog from "../ConfirmDialog.vue"

function buttonByText(text: string): HTMLButtonElement {
  const buttons = Array.from(document.body.querySelectorAll("button"))
  const found = buttons.find((b) => b.textContent?.trim() === text)
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

describe("ConfirmDialog", () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => wrapper?.unmount())

  async function open(props: Record<string, unknown> = {}) {
    wrapper = mount(ConfirmDialog, {
      attachTo: document.body,
      props: { title: "Delete this organization? This cannot be undone.", ...props },
      slots: { default: "<button>Delete Organization</button>" },
    })
    await wrapper.find("button").trigger("click")
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it("shows the title and description after the trigger is clicked", async () => {
    await open({ description: "All projects go with it." })
    const dialog = document.body.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain("Delete this organization?")
    expect(dialog?.textContent).toContain("All projects go with it.")
  })

  it("never emits confirm on Cancel and closes", async () => {
    const w = await open()
    buttonByText("Cancel").click()
    await w.vm.$nextTick()
    expect(w.emitted("confirm")).toBeUndefined()
    await vi.waitFor(() =>
      expect(document.body.querySelector('[role="alertdialog"]')).toBeNull(),
    )
  })

  it("emits confirm once from the action button", async () => {
    const w = await open({ confirmLabel: "Yes" })
    buttonByText("Yes").click()
    await w.vm.$nextTick()
    expect(w.emitted("confirm")).toHaveLength(1)
  })

  it("disables the action button while loading", async () => {
    await open({ loading: true })
    expect(buttonByText("OK").disabled).toBe(true)
  })
})
