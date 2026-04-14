/**
 * Seed: Role-permission mappings.
 *
 * Maps each system role to its granted permissions. The permission
 * sets follow a strict hierarchy:
 *
 *   owner  → ALL 16 permissions (full control)
 *   admin  → ALL except org:delete and org:manage_roles (14 permissions)
 *   member → org:read, project:read, todos:create/read/update/delete (6 permissions)
 *   viewer → org:read, project:read, todos:read (3 permissions)
 *
 * Each organization's roles get the same permission set, since the
 * role definitions are identical across orgs (they're system roles).
 *
 * @module seeds/05_role_permissions
 */

import { PERMISSION_IDS } from "./01_permissions.js"
import { ROLE_IDS } from "./04_roles.js"

/**
 * Helper to create role_permission rows for a given role and permission set.
 *
 * Defined at module scope to avoid re-creation on every seed invocation
 * and to satisfy the consistent-function-scoping lint rule.
 *
 * @param {string} roleId - The role UUID
 * @param {string[]} permissionIds - Array of permission UUIDs to grant
 * @returns {Array<{ role_id: string, permission_id: string }>}
 */
const mapPermissions = (roleId, permissionIds) =>
  permissionIds.map((permissionId) => ({
    role_id: roleId,
    permission_id: permissionId,
  }))

/**
 * All 16 permission IDs — used for the owner role.
 * @type {string[]}
 */
const ALL_PERMISSION_IDS = Object.values(PERMISSION_IDS)

/**
 * Admin permissions — everything except org:delete and org:manage_roles.
 * Admins can manage day-to-day operations but cannot destroy the org
 * or modify the role hierarchy.
 * @type {string[]}
 */
const ADMIN_PERMISSION_IDS = ALL_PERMISSION_IDS.filter(
  (id) => id !== PERMISSION_IDS.org_delete && id !== PERMISSION_IDS.org_manage_roles,
)

/**
 * Member permissions — basic org/project visibility plus full todo CRUD.
 * Members are the typical working users who create and manage their tasks.
 * @type {string[]}
 */
const MEMBER_PERMISSION_IDS = [
  PERMISSION_IDS.org_read,
  PERMISSION_IDS.project_read,
  PERMISSION_IDS.todos_create,
  PERMISSION_IDS.todos_read,
  PERMISSION_IDS.todos_update,
  PERMISSION_IDS.todos_delete,
]

/**
 * Viewer permissions — read-only access to org, projects, and todos.
 * @type {string[]}
 */
const VIEWER_PERMISSION_IDS = [
  PERMISSION_IDS.org_read,
  PERMISSION_IDS.project_read,
  PERMISSION_IDS.todos_read,
]

/**
 * Seed the role_permissions table with permission mappings for all roles.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const rolePermissions = [
    // ── Acme Corp role permissions ──────────────────────────────────
    ...mapPermissions(ROLE_IDS.acme_owner, ALL_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.acme_admin, ADMIN_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.acme_member, MEMBER_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.acme_viewer, VIEWER_PERMISSION_IDS),

    // ── Globex Corporation role permissions ─────────────────────────
    ...mapPermissions(ROLE_IDS.globex_owner, ALL_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.globex_admin, ADMIN_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.globex_member, MEMBER_PERMISSION_IDS),
    ...mapPermissions(ROLE_IDS.globex_viewer, VIEWER_PERMISSION_IDS),
  ]

  // Clear existing mappings and insert fresh data
  await knex("role_permissions").del()
  await knex("role_permissions").insert(rolePermissions)
}
