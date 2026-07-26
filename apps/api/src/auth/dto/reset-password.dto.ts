import { IsString, Matches, MaxLength, MinLength } from "class-validator"
import { Match } from "../../common/validators/match.validator"

export class ResetPasswordDto {
  @Matches(/^[0-9a-f]{64}$/, { message: "token must be a 64-character hex string" })
  token!: string

  // Rules copied verbatim from SignupDto — a reset that accepts a weaker password
  // than signup would be a bypass of the signup policy.
  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  @MaxLength(72, { message: "password must be at most 72 characters" })
  @Matches(/[A-Z]/, { message: "password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "password must contain at least one digit" })
  @Matches(/[^A-Za-z0-9]/, { message: "password must contain at least one special character" })
  password!: string

  @IsString()
  @Match("password", { message: "confirmation_password must match password" })
  confirmation_password!: string
}
