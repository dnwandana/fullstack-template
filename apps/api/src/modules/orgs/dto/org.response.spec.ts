import { toOrgResponse } from "./org.response"
import type { OrgRow } from "../org-row"

const row: OrgRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme",
  description: null,
  createdBy: "22222222-2222-4222-8222-222222222222",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("toOrgResponse", () => {
  it("maps every row field to its snake_case wire key", () => {
    expect(toOrgResponse(row)).toEqual({
      id: row.id,
      name: "Acme",
      description: null,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
  })

  it("passes Date values through untouched", () => {
    expect(toOrgResponse(row).created_at).toBeInstanceOf(Date)
  })

  it("emits exactly the declared keys and no others", () => {
    expect(Object.keys(toOrgResponse(row)).toSorted()).toEqual([
      "created_at",
      "created_by",
      "description",
      "id",
      "name",
      "updated_at",
    ])
  })
})
