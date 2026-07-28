/**
 * Organization Members API service
 * Handles listing, updating roles, and removing members within an organization
 */

import type { Envelope, OrgMember, PaginatedEnvelope, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/** List all members of an organization. */
export function getOrgMembers(
  orgId: string,
): Promise<HttpResult<PaginatedEnvelope<Wire<OrgMember>[]>>> {
  return request.get<PaginatedEnvelope<Wire<OrgMember>[]>>(`/orgs/${orgId}/members`)
}

/** Update the role assigned to an organization member. */
export function updateOrgMemberRole(
  orgId: string,
  userId: string,
  roleId: string,
): Promise<HttpResult<Envelope<Wire<OrgMember>>>> {
  return request.put<Envelope<Wire<OrgMember>>>(`/orgs/${orgId}/members/${userId}`, {
    role_id: roleId,
  })
}

/** Remove a member from an organization. */
export function removeOrgMember(
  orgId: string,
  userId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}/members/${userId}`)
}
