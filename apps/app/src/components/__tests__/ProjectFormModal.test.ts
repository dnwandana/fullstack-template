import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makeProject } from "@/test/fixtures"
import ProjectFormModal from "../ProjectFormModal.vue"

const NAME = 'input[placeholder="Enter project name"]'
let wrapper: VueWrapper

async function open(props: Record<string, unknown> = {}) {
  wrapper = mount(ProjectFormModal, { props: { open: true, ...props }, attachTo: document.body })
  await flushPromises()
}
function q<T extends Element>(sel: string): T {
  const el = document.body.querySelector<T>(sel)
  if (!el) throw new Error(`Missing element ${sel}`)
  return el
}
function type(value: string) {
  q<HTMLInputElement>(NAME).value = value
  q<HTMLInputElement>(NAME).dispatchEvent(new Event("input"))
}
async function submit() {
  q<HTMLFormElement>("form").dispatchEvent(new Event("submit", { cancelable: true }))
  // VeeValidate validates through an async Zod parse. One flush is not enough.
  await vi.waitFor(() => expect(document.body.querySelector("[role=alert]") ?? wrapper.emitted("submit")).toBeTruthy())
}

afterEach(() => wrapper?.unmount())

describe("ProjectFormModal", () => {
  it("shows the create title and empty fields", async () => {
    await open()
    expect(document.body.textContent).toContain("Create Project")
    expect(q<HTMLInputElement>(NAME).value).toBe("")
  })

  it("prefills from the project prop and uses the edit title", async () => {
    await open({ project: makeProject({ name: "Acme", description: "Widgets" }) })
    expect(document.body.textContent).toContain("Edit Project")
    expect(q<HTMLInputElement>(NAME).value).toBe("Acme")
  })

  it("blocks submit and shows the message for an empty name", async () => {
    await open()
    await submit()
    expect(document.body.textContent).toContain("Please enter a project name")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })

  it("emits the payload with description omitted when empty", async () => {
    await open()
    type("Acme")
    await submit()
    expect(wrapper.emitted("submit")).toEqual([[{ name: "Acme", description: undefined }]])
  })

  // Review Focus 2: overlay or X close emits cancel and reopens empty.
  it("emits cancel from the X button and reopens with empty fields", async () => {
    await open()
    type("Draft")
    const buttons = Array.from(document.body.querySelectorAll("button"))
    buttons.find((b) => b.textContent?.includes("Close"))?.click()
    await flushPromises()
    expect(wrapper.emitted("cancel")).toHaveLength(1)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(q<HTMLInputElement>(NAME).value).toBe("")
  })
})
