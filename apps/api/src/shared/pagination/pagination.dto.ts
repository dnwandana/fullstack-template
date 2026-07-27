import { Transform } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

export class PaginationQueryDto {
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page = 1

  @Transform(({ value }) => (value === undefined ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10

  @IsOptional()
  @IsString()
  sort_by?: string

  @Transform(({ value }) => (value === undefined ? "desc" : value))
  @IsIn(["asc", "desc"])
  sort_order: "asc" | "desc" = "desc"

  @Transform(({ value }) => (value === undefined ? "" : value))
  @IsString()
  @MaxLength(255)
  search = ""
}
