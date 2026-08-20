import { ApiProperty } from "@nestjs/swagger"
import type {
  Invitation,
  InvitationList,
  InvitationListItem,
  InvitationPreview,
  InvitationWithToken,
  MyInvitation,
} from "@fullstack/contracts"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import { PaginationMetaResponse } from "@shared/dto/pagination-meta.response"
import type { InviteRow } from "../invite-row"

// `status` stays a plain string because the contract in packages/contracts declares it as
// one, and the SPA compares it to literals. The database does constrain it: 0_init creates
// the InvitationStatus enum and declares the column NOT NULL against it.
export class InvitationResponse implements Invitation {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty({ format: "uuid" }) org_id!: string
  @ApiProperty({ type: String, format: "uuid", nullable: true }) project_id!: string | null
  @ApiProperty({ format: "uuid" }) inviter_id!: string
  @ApiProperty({ type: String, nullable: true }) invitee_email!: string | null
  @ApiProperty({ type: String, format: "uuid", nullable: true }) invitee_id!: string | null
  @ApiProperty({ format: "uuid" }) role_id!: string
  @ApiProperty() status!: string
  @ApiProperty({ format: "date-time" }) expires_at!: Date
  @ApiProperty({ format: "date-time" }) created_at!: Date
  @ApiProperty({ format: "date-time" }) updated_at!: Date
}

// create() and resend() add the raw token because no mail provider ships with the template and the
// caller delivers the link itself. Both keys are part of the wire contract, not debug leftovers.
export class InvitationWithTokenResponse extends InvitationResponse implements InvitationWithToken {
  @ApiProperty() token!: string
  @ApiProperty() accept_url!: string
}

// listForOrg() flattens the inviter/invitee/role relations onto each row.
export class InvitationListItemResponse extends InvitationResponse implements InvitationListItem {
  @ApiProperty() inviter_name!: string
  @ApiProperty({ type: String, nullable: true }) invitee_name!: string | null
  @ApiProperty() role_name!: string
}

export class InvitationListResponse implements InvitationList {
  @ApiProperty({ type: [InvitationListItemResponse] }) data!: InvitationListItemResponse[]
  @ApiProperty({ type: PaginationMetaResponse }) pagination!: PaginationMetaResponse
}

// listMine() flattens a different relation set (organization/project, not invitee) and is
// deliberately unpaginated — it returns a bare array.
export class MyInvitationResponse extends InvitationResponse implements MyInvitation {
  @ApiProperty() org_name!: string
  @ApiProperty({ type: String, nullable: true }) project_name!: string | null
  @ApiProperty() inviter_name!: string
  @ApiProperty() role_name!: string
}

// The public preview endpoint projects its own narrow selection rather than INVITE_SELECT — a
// logged-out caller must not see org_id, inviter_id or role_id.
export class InvitationPreviewResponse implements InvitationPreview {
  @ApiProperty({ format: "uuid" }) id!: string
  @ApiProperty() org_name!: string
  @ApiProperty({ type: String, nullable: true }) project_name!: string | null
  @ApiProperty() inviter_name!: string
  @ApiProperty() role_name!: string
  @ApiProperty({ type: String, nullable: true }) invitee_email!: string | null
  @ApiProperty() status!: string
  @ApiProperty({ format: "date-time" }) expires_at!: Date
  @ApiProperty() is_expired!: boolean
  @ApiProperty() requires_signup!: boolean
}

// The return annotation catches a narrowing only: drop a field from INVITE_SELECT and this stops
// compiling. Adding one does not stop compiling, because the return value is not an object
// literal, so no excess property check runs. The key-set test in
// __tests__/invitation.response.spec.ts is what catches an added field.
export function toInvitationResponse(row: InviteRow): InvitationResponse {
  return toSnakeKeys<InviteRow>(row)
}
