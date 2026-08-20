import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator"
import { IsPlainSingleLine } from "@shared/validators/control-chars"

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsPlainSingleLine()
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("all", { each: true })
  permission_ids!: string[]
}
