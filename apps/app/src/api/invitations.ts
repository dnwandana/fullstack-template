/**
 * Invitations API service
 * Handles creating, listing, previewing, accepting, declining, revoking, and
 * resending invitations
 * Supports both organization-level and project-level invitations
 */

import type {
  Envelope,
  InvitationListItem,
  InvitationPreview,
  InvitationWithToken,
  MyInvitation,
  PaginatedEnvelope,
  Wire,
} from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * The body both invite endpoints send. Declared as `type`, not `interface`, to stay consistent
 * with the other request shapes in this layer.
 */
export type InviteInput = {
  role_id: string
  email: string
}

/** Invite a user to an organization. */
export function inviteToOrg(
  orgId: string,
  data: InviteInput,
): Promise<HttpResult<Envelope<Wire<InvitationWithToken>>>> {
  return request.post<Envelope<Wire<InvitationWithToken>>>(`/orgs/${orgId}/invitations`, data)
}

/** Invite a user to a project within an organization. */
export function inviteToProject(
  orgId: string,
  projectId: string,
  data: InviteInput,
): Promise<HttpResult<Envelope<Wire<InvitationWithToken>>>> {
  return request.post<Envelope<Wire<InvitationWithToken>>>(
    `/orgs/${orgId}/projects/${projectId}/invitations`,
    data,
  )
}

/**
 * List all invitations for an organization.
 * Paginated, unlike `listMyInvitations`: the API's `listForOrg` spreads `{ data, pagination }`
 * into its envelope, while `listMine` returns a bare array under `data`.
 */
export function listOrgInvitations(
  orgId: string,
): Promise<HttpResult<PaginatedEnvelope<Wire<InvitationListItem>[]>>> {
  return request.get<PaginatedEnvelope<Wire<InvitationListItem>[]>>(`/orgs/${orgId}/invitations`)
}

/** List all pending invitations for the currently authenticated user. */
export function listMyInvitations(): Promise<HttpResult<Envelope<Wire<MyInvitation>[]>>> {
  return request.get<Envelope<Wire<MyInvitation>[]>>("/invitations")
}

/**
 * Accept a pending invitation.
 * `token` is the raw 64-char hex invitation token from the invite link, and goes in the body —
 * `AcceptInvitationDto` rejects the call with a 400 without it.
 */
export function acceptInvitation(
  invitationId: string,
  token: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.post<Envelope<null>>(`/invitations/${invitationId}/accept`, { token })
}

/**
 * Preview an invitation without being authenticated.
 * Gated by possession of the raw 64-char hex token, passed as a query param rather than a body;
 * returns org/project/inviter context. `InvitationPreview` is a narrow projection, not a superset
 * of `Invitation` — a logged-out caller must not see org_id, inviter_id or role_id.
 */
export function previewInvitation(
  invitationId: string,
  token: string,
): Promise<HttpResult<Envelope<Wire<InvitationPreview>>>> {
  return request.get<Envelope<Wire<InvitationPreview>>>(`/invitations/${invitationId}/preview`, {
    token,
  })
}

/** Decline a pending invitation. */
export function declineInvitation(invitationId: string): Promise<HttpResult<Envelope<null>>> {
  return request.post<Envelope<null>>(`/invitations/${invitationId}/decline`)
}

/**
 * Revoke an invitation from an organization
 * Only organization admins can revoke invitations
 */
export function revokeInvitation(
  orgId: string,
  invitationId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}/invitations/${invitationId}`)
}

/**
 * Reissue an invitation with a fresh token and expiry
 * Invalidates the previously issued link, and returns the new token and accept_url
 */
export function resendInvitation(
  orgId: string,
  invitationId: string,
): Promise<HttpResult<Envelope<Wire<InvitationWithToken>>>> {
  return request.post<Envelope<Wire<InvitationWithToken>>>(
    `/orgs/${orgId}/invitations/${invitationId}/resend`,
  )
}
