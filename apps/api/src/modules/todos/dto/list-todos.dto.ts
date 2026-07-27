import { IsIn, IsOptional } from "class-validator"
import { PaginationQueryDto } from "@shared/pagination/pagination.dto"
import { TODO_SORTABLE, type TodoSortKey } from "../todo-sort"

// Inherits PaginationQueryDto's limit default of 10 — deliberately not ListQueryDto's 50.
export class ListTodosDto extends PaginationQueryDto {
  // Initializer required so this narrowed override doesn't trip TS2612 against the base
  // `sort_by` field under `useDefineForClassFields`.
  @IsOptional()
  @IsIn(TODO_SORTABLE)
  sort_by?: TodoSortKey = undefined
}
