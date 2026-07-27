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

// The return annotation is the guard: `toSnakeKeys<TodoRow>` produces
// `SnakeKeys<TodoRow>`, so widening TODO_SELECT without updating TodoResponse
// stops compiling here instead of silently changing the public API.
export function toTodoResponse(row: TodoRow): TodoResponse {
  return toSnakeKeys<TodoRow>(row)
}
