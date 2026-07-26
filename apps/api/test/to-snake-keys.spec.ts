import { toSnakeKeys } from "../src/common/to-snake-keys"

describe("toSnakeKeys", () => {
  it("renames camelCase keys to snake_case, shallow only", () => {
    const d = new Date()
    expect(toSnakeKeys({ orgId: "1", inviteeEmail: null, createdAt: d, id: "x" })).toEqual({
      org_id: "1",
      invitee_email: null,
      created_at: d,
      id: "x",
    })
  })

  it("does not recurse into nested objects", () => {
    expect(toSnakeKeys({ roleName: { innerKey: 1 } })).toEqual({ role_name: { innerKey: 1 } })
  })

  it("leaves already-snake keys alone", () => {
    expect(toSnakeKeys({ is_completed: true })).toEqual({ is_completed: true })
  })
})
