/**
 * Project Members API service
 * Handles listing, updating roles, and removing members within a project
 * All endpoints are nested under the parent organization and project
 */

import type { Envelope, PaginatedEnvelope, ProjectMember, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/** List all members of a project. */
export function getProjectMembers(
  orgId: string,
  projectId: string,
): Promise<HttpResult<PaginatedEnvelope<Wire<ProjectMember>[]>>> {
  return request.get<PaginatedEnvelope<Wire<ProjectMember>[]>>(
    `/orgs/${orgId}/projects/${projectId}/members`,
  )
}

/** Update the role assigned to a project member. */
export function updateProjectMemberRole(
  orgId: string,
  projectId: string,
  userId: string,
  roleId: string,
): Promise<HttpResult<Envelope<Wire<ProjectMember>>>> {
  return request.put<Envelope<Wire<ProjectMember>>>(
    `/orgs/${orgId}/projects/${projectId}/members/${userId}`,
    {
      role_id: roleId,
    },
  )
}

/** Remove a member from a project. */
export function removeProjectMember(
  orgId: string,
  projectId: string,
  userId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}/projects/${projectId}/members/${userId}`)
}
