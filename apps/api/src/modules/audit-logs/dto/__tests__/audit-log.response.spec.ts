import { toAuditLogResponse } from "../audit-log.response"
import type { AuditLogRow } from "../../audit-log-row"

const row: AuditLogRow = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  projectId: null,
  actorId: "33333333-3333-4333-8333-333333333333",
  actorName: "Ada Lovelace",
  actorEmail: "ada@example.com",
  action: "todo.updated",
  entityType: "todo",
  entityId: "44444444-4444-4444-8444-444444444444",
  entityName: "write the spec",
  changes: { title: { from: "old", to: "new" } },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

describe("toAuditLogResponse", () => {
  it("maps every row field to its snake_case wire key", () => {
    expect(toAuditLogResponse(row)).toEqual({
      id: row.id,
      org_id: row.orgId,
      project_id: null,
      actor_id: row.actorId,
      actor_name: "Ada Lovelace",
      actor_email: "ada@example.com",
      action: "todo.updated",
      entity_type: "todo",
      entity_id: row.entityId,
      entity_name: "write the spec",
      changes: { title: { from: "old", to: "new" } },
      created_at: row.createdAt,
    })
  })

  it("passes Date values through untouched", () => {
    expect(toAuditLogResponse(row).created_at).toBeInstanceOf(Date)
  })

  it("emits exactly the declared keys and no others", () => {
    expect(Object.keys(toAuditLogResponse(row)).toSorted()).toEqual([
      "action",
      "actor_email",
      "actor_id",
      "actor_name",
      "changes",
      "created_at",
      "entity_id",
      "entity_name",
      "entity_type",
      "id",
      "org_id",
      "project_id",
    ])
  })
})
