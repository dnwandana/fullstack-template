import { Matches } from "class-validator"

export class AcceptInvitationDto {
  @Matches(/^[0-9a-f]{64}$/, { message: "token must be a 64-character hex string" })
  token!: string
}
