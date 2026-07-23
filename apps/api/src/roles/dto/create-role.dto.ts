import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator"

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
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
