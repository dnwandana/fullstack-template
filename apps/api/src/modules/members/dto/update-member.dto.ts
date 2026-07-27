import { IsUUID } from "class-validator"

export class UpdateMemberDto {
  @IsUUID("all")
  role_id!: string
}
