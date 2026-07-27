import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"
import { SORT_COLUMN, TODO_SORTABLE, DEFAULT_TODO_SORT } from "./todo-sort"
import { ListTodosDto } from "./dto/list-todos.dto"

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
    const dto = plainToInstance(ListTodosDto, { sort_by: "created_at" })
    expect(validateSync(dto).length).toBeGreaterThan(0)
  })

  it("accepts every key the column map declares", () => {
    for (const key of TODO_SORTABLE) {
      const dto = plainToInstance(ListTodosDto, { sort_by: key })
      expect(validateSync(dto)).toHaveLength(0)
    }
  })
})
