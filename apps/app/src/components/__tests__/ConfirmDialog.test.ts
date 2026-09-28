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
      props: {
        title: "Delete this organization? This cannot be undone.",
        action: vi.fn().mockResolvedValue(undefined),
        ...props,
      },
      slots: { default: "<button>Delete Organization</button>" },
    })
    await wrapper.find("button").trigger("click")
    await wrapper.vm.$nextTick()
    return wrapper
  }

  function deferred() {
    let resolve: () => void = () => {}
    let reject: (error: Error) => void = () => {}
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const dialog = () => document.body.querySelector('[role="alertdialog"]')
  const pressEscape = () =>
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

  it("shows the title and description after the trigger is clicked", async () => {
    await open({ description: "All projects go with it." })
    const dialog = document.body.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain("Delete this organization?")
    expect(dialog?.textContent).toContain("All projects go with it.")
  })

  it("closes on Cancel and never runs the action", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    await open({ action })
    buttonByText("Cancel").click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(action).not.toHaveBeenCalled()
  })

  it("runs the action from a destructive button and closes when it resolves", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    await open({ action, confirmLabel: "Yes", destructive: true })
    expect(buttonByText("Yes").className).toContain("bg-destructive")
    buttonByText("Yes").click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("shows a spinner, disables both buttons and ignores Escape while the action runs", async () => {
    const { promise, resolve } = deferred()
    const w = await open({ action: () => promise, confirmLabel: "Yes" })
    buttonByText("Yes").click()
    await w.vm.$nextTick()
    expect(buttonByText("Yes").disabled).toBe(true)
    expect(buttonByText("Yes").querySelector('[role="status"]')).not.toBeNull()
    expect(buttonByText("Cancel").disabled).toBe(true)
    pressEscape()
    await w.vm.$nextTick()
    expect(dialog()).not.toBeNull()
    resolve()
    await vi.waitFor(() => expect(dialog()).toBeNull())
  })

  it("runs the action once on a double click", async () => {
    const { promise, resolve } = deferred()
    const action = vi.fn(() => promise)
    await open({ action, confirmLabel: "Yes" })
    buttonByText("Yes").click()
    buttonByText("Yes").click()
    resolve()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("stays open and enables the buttons again when the action rejects", async () => {
    const { promise, reject } = deferred()
    const w = await open({ action: () => promise, confirmLabel: "Yes" })
    buttonByText("Yes").click()
    await w.vm.$nextTick()
    expect(buttonByText("Yes").disabled).toBe(true)
    reject(new Error("409"))
    await vi.waitFor(() => expect(buttonByText("Yes").disabled).toBe(false))
    expect(dialog()).not.toBeNull()
    expect(buttonByText("Cancel").disabled).toBe(false)
  })
})
