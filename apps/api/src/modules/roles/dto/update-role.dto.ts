import { Transform } from "class-transformer"
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator"

const CONTROL_CHARS = /^[^\p{Cc}\p{Zl}\p{Zp}‎‏‪-‮⁦-⁩]+$/u

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(CONTROL_CHARS, { message: "name must not contain control characters" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("all", { each: true })
  permission_ids?: string[]
}
