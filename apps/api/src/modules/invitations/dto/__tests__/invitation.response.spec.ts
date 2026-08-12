import { toInvitationResponse } from "../invitation.response"
import type { InviteRow } from "../../invite-row"

const row: InviteRow = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  projectId: null,
  inviterId: "33333333-3333-4333-8333-333333333333",
  inviteeEmail: "invitee@example.com",
  inviteeId: null,
  roleId: "44444444-4444-4444-8444-444444444444",
  status: "pending",
  expiresAt: new Date("2026-02-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("toInvitationResponse", () => {
  it("maps every row field to its snake_case wire key", () => {
    expect(toInvitationResponse(row)).toEqual({
      id: row.id,
      org_id: row.orgId,
      project_id: null,
      inviter_id: row.inviterId,
      invitee_email: "invitee@example.com",
      invitee_id: null,
      role_id: row.roleId,
      status: "pending",
      expires_at: row.expiresAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
  })

  it("preserves nullable fields as null rather than dropping the key", () => {
    const res = toInvitationResponse(row)
    expect("project_id" in res && "invitee_id" in res).toBe(true)
    expect([res.project_id, res.invitee_id]).toEqual([null, null])
  })

  it("emits exactly the declared keys and no others", () => {
    expect(Object.keys(toInvitationResponse(row)).toSorted()).toEqual([
      "created_at",
      "expires_at",
      "id",
      "invitee_email",
      "invitee_id",
      "inviter_id",
      "org_id",
      "project_id",
      "role_id",
      "status",
      "updated_at",
    ])
  })
})
