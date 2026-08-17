/**
 * Audit logs API service.
 * The audit log is read-only, so this module exposes only the list endpoint,
 * scoped under /orgs/{orgId}/audit-logs.
 */

import type { AuditLog, PaginatedEnvelope, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * Query params accepted by the audit log list endpoint. Declared as `type`, not `interface`, so it
 * satisfies the index signature `QueryParams` requires — TypeScript grants an implicit index
 * signature to object type aliases but not to interface declarations.
 *
 * Server-side defaults: `page` 1, `limit` 10, `sort_order` `desc`. All other params filter the
 * list and are optional.
 */
export type AuditLogListParams = {
  page?: number
  limit?: number
  sort_order?: "asc" | "desc"
  project_id?: string
  actor_id?: string
  action?: string
  entity_type?: string
  date_from?: string
  date_to?: string
  search?: string
}

/** Get a paginated list of audit logs for an organization. */
export function getAuditLogs(
  orgId: string,
  params: AuditLogListParams,
): Promise<HttpResult<PaginatedEnvelope<Wire<AuditLog>[]>>> {
  return request.get<PaginatedEnvelope<Wire<AuditLog>[]>>(`/orgs/${orgId}/audit-logs`, params)
}
