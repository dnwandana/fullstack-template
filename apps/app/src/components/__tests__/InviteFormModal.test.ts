import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makeRole } from "@/test/fixtures"
import InviteFormModal from "../InviteFormModal.vue"

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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

  it("shows the link view with one OK button when acceptUrl is set", async () => {
    await open({ acceptUrl: "http://test/invite/i1?token=abc" })
    const describedBy = q('[role="dialog"]').getAttribute("aria-describedby")
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Copy this link and send it to the invitee. It is shown once.",
    )
    expect(q<HTMLInputElement>("input[readonly]").value).toBe("http://test/invite/i1?token=abc")
    expect(document.body.querySelector(EMAIL)).toBeNull()
    const footer = Array.from(q("[data-slot=dialog-footer]").querySelectorAll("button"))
    expect(footer.map((b) => b.textContent?.trim())).toEqual(["OK"])
    footer[0]?.click()
    expect(wrapper.emitted("cancel")).toHaveLength(1)
  })

  it("keeps the typed values after a submit that does not return a link", async () => {
    await open()
    q<HTMLInputElement>(EMAIL).value = "new@example.com"
    q<HTMLInputElement>(EMAIL).dispatchEvent(new Event("input"))
    wrapper.vm.setRole("r2")
    await submit()
    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    expect(q<HTMLInputElement>(EMAIL).value).toBe("new@example.com")
  })
})
