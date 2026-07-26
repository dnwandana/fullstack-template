import { Transform } from "class-transformer"
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator"
import { Match } from "../../common/validators/match.validator"

const CONTROL_CHARS = /^[^\p{Cc}\p{Zl}\p{Zp}‎‏‪-‮⁦-⁩]+$/u

export class SignupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(CONTROL_CHARS, { message: "name must not contain control characters" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "email must be a valid email" })
  @MaxLength(255)
  email!: string

  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  @MaxLength(128, { message: "password must be at most 128 characters" })
  @Matches(/[A-Z]/, { message: "password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "password must contain at least one digit" })
  @Matches(/[^A-Za-z0-9]/, { message: "password must contain at least one special character" })
  password!: string

  @IsString()
  @Match("password", { message: "confirmation_password must match password" })
  confirmation_password!: string
}
