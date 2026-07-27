import { Transform } from "class-transformer"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator"

export class BulkDeleteDto {
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true, message: "ids must be 1-50 comma-separated valid UUIDs" })
  ids!: string[]
}
