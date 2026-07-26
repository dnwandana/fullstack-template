import { Transform } from "class-transformer"
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

export class SigninDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "email must be a valid email" })
  @MaxLength(255)
  email!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string
}
