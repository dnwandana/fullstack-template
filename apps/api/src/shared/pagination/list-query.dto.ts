import { Transform } from "class-transformer"
import { IsInt, Max, Min } from "class-validator"
import { PaginationQueryDto } from "./pagination.dto"

// Default 50 (not the todos 10): member/invitation tables render whole-list UIs
// in the SPA, which sends no query params — page 1 must hold a typical tenant.
export class ListQueryDto extends PaginationQueryDto {
  @Transform(({ value }) => (value === undefined ? 50 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50
}
