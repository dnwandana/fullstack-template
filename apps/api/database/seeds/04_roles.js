/**
 * Seed: Organization roles.
 *
 * Creates the 4 system roles (owner, admin, member, viewer) for each
 * organization. System roles have `is_system = true` and are protected
 * from deletion or renaming by the application layer.
 *
 * Each organization gets its own copy of these roles because roles
 * are org-scoped (the UNIQUE(org_id, name) constraint ensures no
 * duplicates within an org).
 *
 * Role hierarchy (most to least privileged):
 *   1. owner  — full control including org deletion
 *   2. admin  — manage members and projects, but cannot delete org
 *   3. member — create and manage their own todos, view projects
 *   4. viewer — read-only access
 *
 * @module seeds/04_roles
 */

import { ORG_IDS } from "./03_organizations.js"

/**
 * Helper to generate the 4 system roles for a given organization.
 *
 * Defined at module scope to avoid re-creation on every seed invocation
 * and to satisfy the consistent-function-scoping lint rule.
 *
 * @param {string} orgId - The organization UUID
 * @param {{ owner: string, admin: string, member: string, viewer: string }} ids - Role UUIDs
 * @returns {Array<object>} Array of role rows
 */
const createOrgRoles = (orgId, ids) => [
  {
    id: ids.owner,
    org_id: orgId,
    name: "owner",
    description: "Full control over the organization, including deletion and role management",
    is_system: true,
  },
  {
    id: ids.admin,
    org_id: orgId,
    name: "admin",
    description: "Manage members, projects, and settings — cannot delete org or manage roles",
    is_system: true,
  },
  {
    id: ids.member,
    org_id: orgId,
    name: "member",
    description: "Create and manage todos, view projects and org details",
    is_system: true,
  },
  {
    id: ids.viewer,
    org_id: orgId,
    name: "viewer",
    description: "Read-only access to organization, projects, and todos",
    is_system: true,
  },
]

/**
 * Deterministic role UUIDs for cross-seed referencing.
 * Pattern: c0000000-0000-0000-0000-00000000NNNN
 *
 * Naming convention: {org}_{role} for easy lookup.
 *
 * @type {Record<string, string>}
 */
export const ROLE_IDS = {
  // Acme Corp roles
  acme_owner: "c0000000-0000-0000-0000-000000000001",
  acme_admin: "c0000000-0000-0000-0000-000000000002",
  acme_member: "c0000000-0000-0000-0000-000000000003",
  acme_viewer: "c0000000-0000-0000-0000-000000000004",

  // Globex Corporation roles
  globex_owner: "c0000000-0000-0000-0000-000000000005",
  globex_admin: "c0000000-0000-0000-0000-000000000006",
  globex_member: "c0000000-0000-0000-0000-000000000007",
  globex_viewer: "c0000000-0000-0000-0000-000000000008",
}

/**
 * Seed the roles table with system roles for each organization.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const roles = [
    // Acme Corp system roles
    ...createOrgRoles(ORG_IDS.acme, {
      owner: ROLE_IDS.acme_owner,
      admin: ROLE_IDS.acme_admin,
      member: ROLE_IDS.acme_member,
      viewer: ROLE_IDS.acme_viewer,
    }),
    // Globex Corporation system roles
    ...createOrgRoles(ORG_IDS.globex, {
      owner: ROLE_IDS.globex_owner,
      admin: ROLE_IDS.globex_admin,
      member: ROLE_IDS.globex_member,
      viewer: ROLE_IDS.globex_viewer,
    }),
  ]

  // Clear existing roles and insert fresh data
  await knex("roles").del()
  await knex("roles").insert(roles)
}
