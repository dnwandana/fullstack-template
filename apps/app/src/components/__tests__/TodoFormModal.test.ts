import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makeTodo } from "@/test/fixtures"
import TodoFormModal from "../TodoFormModal.vue"

const TITLE = 'input[placeholder="Enter todo title"]'
const BOX = 'button[role="checkbox"]'
let wrapper: VueWrapper

async function open(props: Record<string, unknown> = {}) {
  wrapper = mount(TodoFormModal, { props: { open: true, ...props }, attachTo: document.body })
  await flushPromises()
}
function q<T extends Element>(sel: string): T {
  const el = document.body.querySelector<T>(sel)
  if (!el) throw new Error(`Missing element ${sel}`)
  return el
}
async function submit() {
  q<HTMLFormElement>("form").dispatchEvent(new Event("submit", { cancelable: true }))
  // VeeValidate validates through an async Zod parse. One flush is not enough.
  await vi.waitFor(() => expect(document.body.querySelector("[role=alert]") ?? wrapper.emitted("submit")).toBeTruthy())
}

afterEach(() => wrapper?.unmount())

describe("TodoFormModal", () => {
  it("uses the create title with an unchecked box", async () => {
    await open()
    expect(document.body.textContent).toContain("Create Todo")
    expect(document.body.textContent).toContain("Mark as completed")
    expect(q<HTMLButtonElement>(BOX).getAttribute("aria-checked")).toBe("false")
  })

  it("prefills title and completion from the todo prop", async () => {
    await open({ todo: makeTodo({ title: "Ship", is_completed: true }) })
    expect(document.body.textContent).toContain("Edit Todo")
    expect(q<HTMLInputElement>(TITLE).value).toBe("Ship")
    expect(q<HTMLButtonElement>(BOX).getAttribute("aria-checked")).toBe("true")
  })

  it("shows the title message and blocks submit when empty", async () => {
    await open()
    await submit()
    expect(document.body.textContent).toContain("Please enter a title")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })

  it("emits the payload with is_completed", async () => {
    await open()
    q<HTMLInputElement>(TITLE).value = "Ship"
    q<HTMLInputElement>(TITLE).dispatchEvent(new Event("input"))
    q<HTMLButtonElement>(BOX).click()
    await submit()
    expect(wrapper.emitted("submit")).toEqual([
      [{ title: "Ship", description: undefined, is_completed: true }],
    ])
  })
})
