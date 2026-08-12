import { toRoleResponse } from "../role.response"
import type { RoleRow } from "../../role-row"

const row: RoleRow = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  name: "admin",
  description: "Full access",
  isSystem: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

const permissions = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "todo:create",
    resource: "todo",
    action: "create",
    description: null,
  },
]

describe("toRoleResponse", () => {
  it("maps the row and attaches the permission list", () => {
    expect(toRoleResponse(row, permissions)).toEqual({
      id: row.id,
      org_id: row.orgId,
      name: "admin",
      description: "Full access",
      is_system: true,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      permissions,
    })
  })

  it("leaves permission keys untouched — they are already snake-free", () => {
    const [first] = toRoleResponse(row, permissions).permissions
    expect(Object.keys(first ?? {}).toSorted()).toEqual([
      "action",
      "description",
      "id",
      "name",
      "resource",
    ])
  })

  it("emits exactly the declared top-level keys", () => {
    expect(Object.keys(toRoleResponse(row, permissions)).toSorted()).toEqual([
      "created_at",
      "description",
      "id",
      "is_system",
      "name",
      "org_id",
      "permissions",
      "updated_at",
    ])
  })
})
