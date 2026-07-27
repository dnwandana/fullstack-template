import { Transform } from "class-transformer"
import { IsEmail, IsUUID, MaxLength } from "class-validator"

export class CreateInvitationDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string

  @IsUUID("all")
  role_id!: string
}
