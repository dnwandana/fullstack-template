import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { IsPlainSingleLine } from "@shared/validators/control-chars"

export class TodoBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @IsPlainSingleLine()
  title!: string

  // No control-character rule here on purpose: the rule rejects the newline, and a
  // description is multi-line free text.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean
}
