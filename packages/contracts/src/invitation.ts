import type { PaginationMeta } from "./pagination"

// `status` is a plain string on purpose: the Prisma column is a string with no
// database-level constraint, so publishing a union would claim an invariant the
// schema does not enforce.
export type Invitation = {
  id: string
  org_id: string
  project_id: string | null
  inviter_id: string
  invitee_email: string | null
  invitee_id: string | null
  role_id: string
  status: string
  expires_at: Date
  created_at: Date
  updated_at: Date
}

export type InvitationWithToken = Invitation & {
  token: string
  accept_url: string
}

export type InvitationListItem = Invitation & {
  inviter_name: string
  invitee_name: string | null
  role_name: string
}

export type InvitationList = {
  data: InvitationListItem[]
  pagination: PaginationMeta
}

export type MyInvitation = Invitation & {
  org_name: string
  project_name: string | null
  inviter_name: string
  role_name: string
}

// The public preview is its own narrow projection, not a superset of Invitation:
// a logged-out caller must not see org_id, inviter_id or role_id.
export type InvitationPreview = {
  id: string
  org_name: string
  project_name: string | null
  inviter_name: string
  role_name: string
  invitee_email: string | null
  status: string
  expires_at: Date
  is_expired: boolean
  requires_signup: boolean
}
