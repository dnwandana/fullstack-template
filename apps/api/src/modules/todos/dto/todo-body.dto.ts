import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class TodoBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean
}
