import { mount, type VueWrapper } from "@vue/test-utils"
import { makeInvitationListItem } from "@/test/fixtures"
import InvitationsTable from "../InvitationsTable.vue"

const PAST = "2020-01-01T00:00:00.000Z"
// The fixture default expiry is in the past, so live rows need an explicit future date.
const FUTURE = "2999-01-01T00:00:00.000Z"

// The vendored Badge has no data-slot attribute, so match its root by shape.
const BADGE = '[data-slot="badge"]'

function buttonByText(text: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!found) throw new Error(`Missing button ${text}`)
  return found
}

describe("InvitationsTable", () => {
  let wrapper: VueWrapper | undefined
  afterEach(() => wrapper?.unmount())

  it("maps each status to a badge variant", () => {
    wrapper = mount(InvitationsTable, {
      props: {
        invitations: [
          makeInvitationListItem({ id: "i1", status: "pending", expires_at: FUTURE }),
          makeInvitationListItem({ id: "i2", status: "accepted" }),
          makeInvitationListItem({ id: "i3", status: "declined" }),
          makeInvitationListItem({ id: "i4", status: "pending", expires_at: PAST }),
        ],
      },
    })
    const badges = wrapper.findAll(BADGE)
    expect(badges.map((b) => b.text())).toEqual(["pending", "accepted", "declined", "expired"])
    expect(badges[0]?.classes()).toContain("bg-warning")
    expect(badges[1]?.classes()).toContain("bg-success")
    expect(badges[2]?.classes()).toContain("bg-destructive/10")
    expect(badges[3]?.classes()).toContain("bg-secondary")
  })

  it("renders actions only for stored pending rows", () => {
    wrapper = mount(InvitationsTable, {
      props: {
        canRevoke: true,
        canResend: true,
        invitations: [
          makeInvitationListItem({ id: "i1", status: "pending", expires_at: PAST }),
          makeInvitationListItem({ id: "i2", status: "accepted" }),
        ],
      },
    })
    expect(wrapper.findAll("button").map((b) => b.text())).toEqual(["New link", "Revoke"])
  })

  it("emits resend directly and runs revokeAction after the dialog confirms", async () => {
    const revokeAction = vi.fn().mockResolvedValue(undefined)
    wrapper = mount(InvitationsTable, {
      attachTo: document.body,
      props: {
        canRevoke: true,
        canResend: true,
        invitations: [makeInvitationListItem()],
        revokeAction,
      },
    })
    buttonByText("New link").click()
    expect(wrapper.emitted("resend")).toEqual([["inv1"]])
    buttonByText("Revoke").click()
    await wrapper.vm.$nextTick()
    expect(revokeAction).not.toHaveBeenCalled()
    buttonByText("Yes").click()
    await vi.waitFor(() => expect(document.body.querySelector('[role="alertdialog"]')).toBeNull())
    expect(revokeAction).toHaveBeenCalledWith("inv1")
  })

  it("shows the role and the scope, with the project name for a project invitation", () => {
    wrapper = mount(InvitationsTable, {
      props: {
        invitations: [
          makeInvitationListItem({ id: "i1", role_name: "viewer" }),
          makeInvitationListItem({ id: "i2", project_id: "p1", project_name: "Mobile App" }),
        ],
      },
    })
    expect(wrapper.findAll("th").map((th) => th.text())).toEqual([
      "Invitee",
      "Role",
      "Scope",
      "Status",
      "Expires",
      "Created",
    ])
    const rows = wrapper.findAll("tbody tr")
    expect(rows[0]?.findAll("td")[1]?.text()).toBe("viewer")
    expect(rows[0]?.findAll("td")[2]?.text()).toBe("Organization")
    expect(rows[1]?.findAll("td")[2]?.text()).toBe("Mobile App")
  })

  it("shows the email in weight 500, or the invitee id in muted mono", () => {
    wrapper = mount(InvitationsTable, {
      props: {
        invitations: [
          makeInvitationListItem({ id: "i1", invitee_email: "amira@studio.io" }),
          makeInvitationListItem({ id: "i2", invitee_email: null, invitee_id: "c1f0a9e2" }),
        ],
      },
    })
    const [email, id] = wrapper.findAll('[data-slot="invitee"]')
    expect(email?.classes()).toContain("font-medium")
    expect(id?.text()).toBe("c1f0a9e2")
    expect(id?.classes()).toEqual(
      expect.arrayContaining(["font-mono", "text-xs", "text-muted-foreground"]),
    )
  })

  it("formats both dates in muted tabular text", () => {
    wrapper = mount(InvitationsTable, { props: { invitations: [makeInvitationListItem()] } })
    const cells = wrapper.findAll("tbody td")
    expect(cells[5]?.text()).toBe("Jan 1, 2026")
    expect(cells[5]?.classes()).toEqual(
      expect.arrayContaining(["text-muted-foreground", "tabular-nums"]),
    )
  })

  it("puts a Link icon on New link", () => {
    wrapper = mount(InvitationsTable, {
      props: { canResend: true, invitations: [makeInvitationListItem()] },
    })
    const button = wrapper.findAll("button").find((b) => b.text() === "New link")
    expect(button?.find("svg.lucide-link").exists()).toBe(true)
  })

  it("shows 4 skeleton rows on the first load and one No invitations row when empty", async () => {
    wrapper = mount(InvitationsTable, { props: { loading: true, canRevoke: true } })
    expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(4)
    await wrapper.setProps({ loading: false })
    expect(wrapper.text()).toContain("No invitations")
    expect(wrapper.find("tbody td").attributes("colspan")).toBe("7")
  })
})
