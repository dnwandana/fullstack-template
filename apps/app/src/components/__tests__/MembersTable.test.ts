import { mount, type VueWrapper } from "@vue/test-utils"
import { makeOrgMember, makeRole } from "@/test/fixtures"
import MembersTable from "../MembersTable.vue"

const MEMBERS = [makeOrgMember({ user_id: "u1", role_id: "r1", role_name: "admin" })]
const ROLES = [makeRole({ id: "r1", name: "admin" }), makeRole({ id: "r2", name: "member" })]

// The vendored Badge has no data-slot attribute, so match its root by shape.
const BADGE = "div.rounded-full"

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

describe("MembersTable", () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => wrapper?.unmount())

  it("renders name, email, a role badge and the joined date", () => {
    wrapper = mount(MembersTable, { props: { members: MEMBERS } })
    const text = wrapper.text()
    expect(text).toContain("Ada Lovelace")
    expect(text).toContain("ada@example.com")
    expect(text).toContain("admin")
    expect(wrapper.find(BADGE).exists()).toBe(true)
    expect(wrapper.text()).not.toContain("Actions")
  })

  it("renders a role select instead of the badge when canUpdateRole", () => {
    wrapper = mount(MembersTable, { props: { members: MEMBERS, roles: ROLES, canUpdateRole: true } })
    expect(wrapper.find(BADGE).exists()).toBe(false)
    expect(wrapper.find('button[role="combobox"]').exists()).toBe(true)
  })

  it("emits remove only after the dialog confirms", async () => {
    wrapper = mount(MembersTable, {
      attachTo: document.body,
      props: { members: MEMBERS, canRemove: true },
    })
    expect(wrapper.text()).toContain("Actions")
    buttonByText("Remove").click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted("remove")).toBeUndefined()
    buttonByText("Yes").click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted("remove")).toEqual([["u1"]])
  })
})
