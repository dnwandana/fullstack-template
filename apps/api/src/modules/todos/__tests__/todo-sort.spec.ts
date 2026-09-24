import { SORT_COLUMN, TODO_SORTABLE, DEFAULT_TODO_SORT } from "../todo-sort"
import { listTodosSchema } from "../dto/list-todos.dto"

describe("todo sort map", () => {
  it("derives the sortable list from the column map", () => {
    expect(TODO_SORTABLE.toSorted()).toEqual(Object.keys(SORT_COLUMN).toSorted())
  })

  it("maps every sortable key to a prisma column", () => {
    for (const key of TODO_SORTABLE) {
      expect(SORT_COLUMN[key]).toBeDefined()
    }
  })

  it("defaults to a key that is itself sortable", () => {
    expect(TODO_SORTABLE).toContain(DEFAULT_TODO_SORT)
  })

  it("rejects a sort_by outside the column map", () => {
    expect(listTodosSchema.safeParse({ sort_by: "created_at" }).success).toBe(false)
  })

  it("accepts every key the column map declares", () => {
    for (const key of TODO_SORTABLE) {
      expect(listTodosSchema.safeParse({ sort_by: key }).success).toBe(true)
    }
  })
})
