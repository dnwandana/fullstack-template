import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makePermission, makeRole } from "@/test/fixtures"
import RoleFormModal from "../RoleFormModal.vue"

const P1 = makePermission({ id: "p1", resource: "org", description: "Read org" })
const P2 = makePermission({ id: "p2", resource: "org", description: "Update org" })
const P3 = makePermission({ id: "p3", resource: "todo", description: "Read todos" })
const NAME = 'input[placeholder="Enter role name"]'
let wrapper: VueWrapper

async function open(props: Record<string, unknown> = {}) {
  wrapper = mount(RoleFormModal, {
    props: { open: true, permissions: [P1, P2, P3], ...props },
    attachTo: document.body,
  })
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

describe("RoleFormModal", () => {
  it("uses the create title with an empty name", async () => {
    await open()
    expect(document.body.textContent).toContain("Create Role")
    expect(q<HTMLInputElement>(NAME).value).toBe("")
  })

  it("shows both messages on an empty submit", async () => {
    await open()
    await submit()
    expect(document.body.textContent).toContain("Please enter a role name")
    expect(document.body.textContent).toContain("Please select at least one permission")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })

  it("prefills from the role and emits its permission ids", async () => {
    await open({ role: makeRole({ name: "Auditor", permissions: [P1] }) })
    expect(document.body.textContent).toContain("Edit Role")
    expect(q<HTMLInputElement>(NAME).value).toBe("Auditor")
    await submit()
    expect(wrapper.emitted("submit")).toEqual([[{ name: "Auditor", description: undefined, permissions: ["p1"] }]])
  })

  function boxes() {
    return Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]'))
  }

  it("groups permissions by resource with a capitalized header", async () => {
    await open()
    const headers = Array.from(document.body.querySelectorAll("[data-testid='perm-group']"))
    expect(headers.map((h) => h.textContent?.trim())).toEqual(["org", "todo"])
    expect(headers[0]?.className).toContain("capitalize")
    expect(boxes()).toHaveLength(3)
  })

  it("toggles a permission and emits the checked ids", async () => {
    await open({ role: makeRole({ name: "Auditor", permissions: [P1] }) })
    expect(boxes()[0]?.getAttribute("aria-checked")).toBe("true")
    boxes()[2]?.click()
    await submit()
    expect(wrapper.emitted("submit")).toEqual([[{ name: "Auditor", description: undefined, permissions: ["p1", "p3"] }]])
  })

  it("emits cancel from the X button and reopens with empty fields", async () => {
    await open()
    q<HTMLInputElement>(NAME).value = "Draft"
    q<HTMLInputElement>(NAME).dispatchEvent(new Event("input"))
    boxes()[0]?.click()
    await flushPromises()
    expect(boxes()[0]?.getAttribute("aria-checked")).toBe("true")
    const buttons = Array.from(document.body.querySelectorAll("button"))
    buttons.find((b) => b.textContent?.includes("Close"))?.click()
    await flushPromises()
    expect(wrapper.emitted("cancel")).toHaveLength(1)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(q<HTMLInputElement>(NAME).value).toBe("")
    expect(boxes().every((b) => b.getAttribute("aria-checked") === "false")).toBe(true)
    await submit()
    expect(document.body.textContent).toContain("Please enter a role name")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })
})
