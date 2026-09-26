import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makeRole } from "@/test/fixtures"
import InviteFormModal from "../InviteFormModal.vue"

const ROLES = [makeRole({ id: "r1", name: "Admin" }), makeRole({ id: "r2", name: "Member" })]
const EMAIL = 'input[placeholder="Enter email address"]'
let wrapper: VueWrapper<InstanceType<typeof InviteFormModal>>

async function open(props: Record<string, unknown> = {}) {
  wrapper = mount(InviteFormModal, {
    props: { open: true, roles: ROLES, ...props },
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

describe("InviteFormModal", () => {
  it("renders the title, email input and role trigger", async () => {
    await open()
    expect(document.body.textContent).toContain("Invite Member")
    expect(q(EMAIL)).not.toBeNull()
    expect(document.body.textContent).toContain("Select a role")
  })

  it("shows both messages on an empty submit", async () => {
    await open()
    await submit()
    expect(document.body.textContent).toContain("Please enter an email address")
    expect(document.body.textContent).toContain("Please select a role")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })

  it("emits email and role_id once both are valid", async () => {
    await open()
    q<HTMLInputElement>(EMAIL).value = "new@example.com"
    q<HTMLInputElement>(EMAIL).dispatchEvent(new Event("input"))
    // reka Select is keyboard-driven in jsdom. Set the value through the form API instead.
    wrapper.vm.setRole("r2")
    await submit()
    expect(wrapper.emitted("submit")).toEqual([[{ email: "new@example.com", role_id: "r2" }]])
  })

  it("emits cancel from the X button and reopens with empty fields", async () => {
    await open()
    q<HTMLInputElement>(EMAIL).value = "draft@example.com"
    q<HTMLInputElement>(EMAIL).dispatchEvent(new Event("input"))
    wrapper.vm.setRole("r2")
    await flushPromises()
    const buttons = Array.from(document.body.querySelectorAll("button"))
    buttons.find((b) => b.textContent?.includes("Close"))?.click()
    await flushPromises()
    expect(wrapper.emitted("cancel")).toHaveLength(1)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(q<HTMLInputElement>(EMAIL).value).toBe("")
    await submit()
    expect(document.body.textContent).toContain("Please enter an email address")
    expect(document.body.textContent).toContain("Please select a role")
    expect(wrapper.emitted("submit")).toBeUndefined()
  })
})
