/**
 * Permissions API service
 * Retrieves the list of all available permissions in the system
 */

import type { Envelope, Permission, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * List all available permissions
 * Used when creating or editing roles to select which permissions to assign
 */
export function getPermissions(): Promise<HttpResult<Envelope<Wire<Permission>[]>>> {
  return request.get<Envelope<Wire<Permission>[]>>("/permissions")
}
