/**
 * Permissions API service
 * Retrieves the list of all available permissions in the system
 */

import { request } from "@/utils/http"

/**
 * List all available permissions
 * Used when creating or editing roles to select which permissions to assign
 * @returns {Promise} API response with list of all permissions
 */
export function getPermissions() {
  return request.get("/permissions")
}