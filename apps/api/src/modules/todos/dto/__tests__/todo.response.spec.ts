import { toTodoResponse } from "../todo.response"
import type { TodoRow } from "../../todo-row"

const row: TodoRow = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  title: "write the spec",
  description: null,
  isCompleted: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("toTodoResponse", () => {
  it("maps every row field to its snake_case wire key", () => {
    expect(toTodoResponse(row)).toEqual({
      id: row.id,
      project_id: row.projectId,
      user_id: row.userId,
      title: "write the spec",
      description: null,
      is_completed: false,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
  })

  it("passes Date values through untouched", () => {
    expect(toTodoResponse(row).created_at).toBeInstanceOf(Date)
  })

  it("emits exactly the declared keys and no others", () => {
    expect(Object.keys(toTodoResponse(row)).toSorted()).toEqual([
      "created_at",
      "description",
      "id",
      "is_completed",
      "project_id",
      "title",
      "updated_at",
      "user_id",
    ])
  })
})
