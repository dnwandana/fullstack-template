import { IsString, Matches, MaxLength, MinLength } from "class-validator"
import { Match } from "@shared/validators/match.validator"

export class ResetPasswordDto {
  @Matches(/^[0-9a-f]{64}$/, { message: "token must be a 64-character hex string" })
  token!: string

  // Rules copied verbatim from SignupDto — a reset accepting a weaker password than signup
  // would bypass the signup policy. The 8–128 cap is real; the old 72-char ceiling was a
  // bcrypt artifact (L-15), not an Argon2 constraint.
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
