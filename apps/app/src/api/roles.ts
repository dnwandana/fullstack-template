/**
 * Roles API service
 * Handles CRUD operations for roles and their permissions within an organization
 * Supports both system-defined and custom roles
 */

import type { Envelope, Role, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * Role data as the form layer emits it. `permissions` is an array of permission **UUIDs**, not
 * permission objects.
 */
export type RoleFormInput = {
  name: string
  description?: string
  permissions?: string[]
}

/** The body the API's role DTO expects. */
type RoleRequestBody = {
  name: string
  description?: string
  permission_ids?: string[]
}

/** List all roles in an organization (system + custom). */
export function getRoles(orgId: string): Promise<HttpResult<Envelope<Wire<Role>[]>>> {
  return request.get<Envelope<Wire<Role>[]>>(`/orgs/${orgId}/roles`)
}

/** Get a single role with its assigned permissions. */
export function getRole(orgId: string, roleId: string): Promise<HttpResult<Envelope<Wire<Role>>>> {
  return request.get<Envelope<Wire<Role>>>(`/orgs/${orgId}/roles/${roleId}`)
}

/**
 * Remap the form-layer `permissions` key to the API's `permission_ids`
 * contract. `permissions` already holds an array of permission UUID
 * strings (not objects) — only the key name needs to change. Omitted
 * entirely when not provided, so callers that don't touch permissions
 * (e.g. renaming a role) never send a spurious key.
 */
function toRequestBody({ permissions, ...rest }: RoleFormInput): RoleRequestBody {
  return permissions === undefined ? rest : { ...rest, permission_ids: permissions }
}

/** Create a new custom role in an organization. */
export function createRole(
  orgId: string,
  data: RoleFormInput,
): Promise<HttpResult<Envelope<Wire<Role>>>> {
  return request.post<Envelope<Wire<Role>>>(`/orgs/${orgId}/roles`, toRequestBody(data))
}

/** Update an existing role in an organization. */
export function updateRole(
  orgId: string,
  roleId: string,
  data: RoleFormInput,
): Promise<HttpResult<Envelope<Wire<Role>>>> {
  return request.put<Envelope<Wire<Role>>>(`/orgs/${orgId}/roles/${roleId}`, toRequestBody(data))
}

/** Delete a custom role from an organization. */
export function deleteRole(orgId: string, roleId: string): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}/roles/${roleId}`)
}
