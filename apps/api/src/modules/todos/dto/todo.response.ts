import { ApiProperty } from "@nestjs/swagger"
import type { Todo, TodoList } from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import { PaginationMetaResponse } from "@shared/dto/pagination-meta.response"
import type { TodoRow } from "../todo-row"

export class TodoResponse implements Todo {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty({ format: "uuid" }) project_id!: string
  @ApiProperty({ format: "uuid" }) user_id!: string
  @ApiProperty() title!: string
  @ApiProperty({ type: String, nullable: true }) description!: string | null
  @ApiProperty() is_completed!: boolean
  @ApiProperty({ format: "date-time" }) created_at!: Date
  @ApiProperty({ format: "date-time" }) updated_at!: Date
}

export class TodoListResponse implements TodoList {
  @ApiProperty({ type: [TodoResponse] }) data!: TodoResponse[]
  @ApiProperty({ type: PaginationMetaResponse }) pagination!: PaginationMetaResponse
}

// The return annotation catches a narrowing only: drop a field from TODO_SELECT and this stops
// compiling. Adding one does not stop compiling, because the return value is not an object
// literal, so no excess property check runs. The key-set test in __tests__/todo.response.spec.ts
// is what catches an added field.
export function toTodoResponse(row: TodoRow): TodoResponse {
  return toSnakeKeys<TodoRow>(row)
}
