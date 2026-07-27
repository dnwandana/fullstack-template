import { Transform } from "class-transformer"
import { IsEmail, MaxLength } from "class-validator"

export class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "email must be a valid email" })
  @MaxLength(255)
  email!: string
}
