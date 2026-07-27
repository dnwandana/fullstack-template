import { toProjectResponse } from "./project.response"
import type { ProjectRow } from "../project-row"

const row: ProjectRow = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  name: "Apollo",
  description: null,
  createdBy: "33333333-3333-4333-8333-333333333333",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("toProjectResponse", () => {
  it("maps every row field to its snake_case wire key", () => {
    expect(toProjectResponse(row)).toEqual({
      id: row.id,
      org_id: row.orgId,
      name: "Apollo",
      description: null,
      created_by: row.createdBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
  })

  it("passes Date values through untouched", () => {
    expect(toProjectResponse(row).created_at).toBeInstanceOf(Date)
  })

  it("emits exactly the declared keys and no others", () => {
    expect(Object.keys(toProjectResponse(row)).toSorted()).toEqual([
      "created_at",
      "created_by",
      "description",
      "id",
      "name",
      "org_id",
      "updated_at",
    ])
  })
})
