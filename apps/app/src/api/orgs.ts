/**
 * Organizations API service
 * Handles CRUD operations for user organizations
 */

import type { Envelope, Org, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/** The body `createOrg` and `updateOrg` send. Mirrors the API's `CreateOrgDto`. */
export interface OrgInput {
  name: string
  description?: string
}

/**
 * Get list of organizations the current user belongs to
 */
export function getOrgs(): Promise<HttpResult<Envelope<Wire<Org>[]>>> {
  return request.get<Envelope<Wire<Org>[]>>("/orgs")
}

/**
 * Get a single organization by ID
 */
export function getOrg(orgId: string): Promise<HttpResult<Envelope<Wire<Org>>>> {
  return request.get<Envelope<Wire<Org>>>(`/orgs/${orgId}`)
}

/**
 * Create a new organization
 */
export function createOrg(data: OrgInput): Promise<HttpResult<Envelope<Wire<Org>>>> {
  return request.post<Envelope<Wire<Org>>>("/orgs", data)
}

/**
 * Update an existing organization
 */
export function updateOrg(orgId: string, data: OrgInput): Promise<HttpResult<Envelope<Wire<Org>>>> {
  return request.put<Envelope<Wire<Org>>>(`/orgs/${orgId}`, data)
}

/**
 * Delete an organization
 */
export function deleteOrg(orgId: string): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}`)
}
