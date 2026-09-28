import { flushPromises, mount, type VueWrapper } from "@vue/test-utils"
import { makeOrgMember, makeRole } from "@/test/fixtures"
import MembersTable from "../MembersTable.vue"

const MEMBERS = [makeOrgMember({ user_id: "u1", role_id: "r1", role_name: "admin" })]
const ROLES = [makeRole({ id: "r1", name: "admin" }), makeRole({ id: "r2", name: "member" })]

// The vendored Badge has no data-slot attribute, so match its root by shape.
const BADGE = '[data-slot="badge"]'

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

  const dialog = () => document.body.querySelector('[role="alertdialog"]')

  it("runs removeAction only after the dialog confirms, then closes", async () => {
    const removeAction = vi.fn().mockResolvedValue(undefined)
    wrapper = mount(MembersTable, {
      attachTo: document.body,
      props: { members: MEMBERS, canRemove: true, removeAction },
    })
    buttonByText("Remove").click()
    await wrapper.vm.$nextTick()
    expect(removeAction).not.toHaveBeenCalled()
    buttonByText("Yes").click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(removeAction).toHaveBeenCalledWith("u1")
  })

  it("keeps the dialog open when removeAction rejects", async () => {
    const removeAction = vi.fn().mockRejectedValue(new Error("409"))
    wrapper = mount(MembersTable, {
      attachTo: document.body,
      props: { members: MEMBERS, canRemove: true, removeAction },
    })
    buttonByText("Remove").click()
    await wrapper.vm.$nextTick()
    buttonByText("Yes").click()
    await flushPromises()
    expect(removeAction).toHaveBeenCalledTimes(1)
    expect(dialog()).not.toBeNull()
  })

  it("renders a 28 px avatar, the name in weight 500 and muted email and joined cells", () => {
    wrapper = mount(MembersTable, { props: { members: MEMBERS } })
    const row = wrapper.find("tbody tr")
    expect(row.find('[data-slot="user-avatar"]').text()).toBe("A")
    expect(row.find('[data-slot="member-name"]').classes()).toContain("font-medium")
    const cells = row.findAll("td")
    expect(cells[1]?.classes()).toContain("text-muted-foreground")
    expect(cells[3]?.text()).toBe("Jan 1, 2026")
    expect(cells[3]?.classes()).toContain("text-muted-foreground")
  })

  it("shows 4 skeleton rows while the first load runs", () => {
    wrapper = mount(MembersTable, { props: { members: [], loading: true, canRemove: true } })
    const rows = wrapper.findAll('[data-slot="skeleton-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]?.findAll("td")).toHaveLength(5)
    expect(wrapper.text()).not.toContain("No members")
  })

  it("shows one No members row when the list is empty", () => {
    wrapper = mount(MembersTable, { props: { members: [] } })
    expect(wrapper.findAll("tbody tr")).toHaveLength(1)
    expect(wrapper.find("tbody td").attributes("colspan")).toBe("4")
    expect(wrapper.text()).toContain("No members")
  })

  it("uses a 32 px role select and a right-aligned actions column", () => {
    wrapper = mount(MembersTable, {
      props: { members: MEMBERS, roles: ROLES, canUpdateRole: true, canRemove: true },
    })
    expect(wrapper.find('button[role="combobox"]').classes()).toEqual(
      expect.arrayContaining(["h-8", "w-[140px]"]),
    )
    expect(wrapper.findAll("th").at(-1)?.classes()).toEqual(
      expect.arrayContaining(["w-[1%]", "text-right"]),
    )
  })
})
