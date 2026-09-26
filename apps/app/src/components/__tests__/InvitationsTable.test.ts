import { mount, type VueWrapper } from "@vue/test-utils"
import { makeInvitationListItem } from "@/test/fixtures"
import InvitationsTable from "../InvitationsTable.vue"

const PAST = "2020-01-01T00:00:00.000Z"
// The fixture default expiry is in the past, so live rows need an explicit future date.
const FUTURE = "2999-01-01T00:00:00.000Z"

// The vendored Badge has no data-slot attribute, so match its root by shape.
const BADGE = "div.rounded-full"

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
    expect(badges[2]?.classes()).toContain("bg-destructive")
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

  it("emits resend directly and revoke after the dialog confirms", async () => {
    wrapper = mount(InvitationsTable, {
      attachTo: document.body,
      props: { canRevoke: true, canResend: true, invitations: [makeInvitationListItem()] },
    })
    buttonByText("New link").click()
    expect(wrapper.emitted("resend")).toEqual([["inv1"]])
    buttonByText("Revoke").click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted("revoke")).toBeUndefined()
    buttonByText("Yes").click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted("revoke")).toEqual([["inv1"]])
  })
})
