import { IsIn, IsOptional } from "class-validator"
import { PaginationQueryDto } from "../../common/pagination/pagination.dto"

const SORTABLE = ["updated_at", "title"] as const

export class ListTodosDto extends PaginationQueryDto {
  // Initializer required so this narrowed override doesn't trip TS2612 against
  // the base `sort_by` field under `useDefineForClassFields`.
  @IsOptional()
  @IsIn(SORTABLE)
  sort_by?: (typeof SORTABLE)[number] = undefined
}
