/**
 * Seed: Organization memberships.
 *
 * Assigns users to organizations with specific roles:
 *
 * Acme Corp:
 *   - john.doe        → owner   (created the org)
 *   - jane.doe        → admin   (manages day-to-day)
 *   - AlexTheBuilder  → member  (regular contributor)
 *   - sudo_sam        → viewer  (read-only observer)
 *
 * Globex Corporation:
 *   - CloudArchitect  → owner   (created the org)
 *   - AlexTheBuilder  → member  (cross-org contributor)
 *   - sudo_sam        → admin   (manages Globex operations)
 *
 * Note: AlexTheBuilder and sudo_sam belong to both orgs, demonstrating
 * multi-org membership with different roles in each.
 *
 * @module seeds/06_org_members
 */

import { USER_IDS } from "./02_users.js"
import { ORG_IDS } from "./03_organizations.js"
import { ROLE_IDS } from "./04_roles.js"

/**
 * Seed the org_members table with user-organization-role mappings.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const orgMembers = [
    // ── Acme Corp memberships ───────────────────────────────────────
    {
      user_id: USER_IDS.john_doe,
      org_id: ORG_IDS.acme,
      role_id: ROLE_IDS.acme_owner,
      joined_at: "2025-02-01T09:00:00.000Z",
    },
    {
      user_id: USER_IDS.jane_doe,
      org_id: ORG_IDS.acme,
      role_id: ROLE_IDS.acme_admin,
      joined_at: "2025-02-02T10:00:00.000Z",
    },
    {
      user_id: USER_IDS.alex,
      org_id: ORG_IDS.acme,
      role_id: ROLE_IDS.acme_member,
      joined_at: "2025-02-03T11:00:00.000Z",
    },
    {
      user_id: USER_IDS.sudo_sam,
      org_id: ORG_IDS.acme,
      role_id: ROLE_IDS.acme_viewer,
      joined_at: "2025-02-04T12:00:00.000Z",
    },

    // ── Globex Corporation memberships ──────────────────────────────
    {
      user_id: USER_IDS.cloud,
      org_id: ORG_IDS.globex,
      role_id: ROLE_IDS.globex_owner,
      joined_at: "2025-02-05T14:00:00.000Z",
    },
    {
      user_id: USER_IDS.alex,
      org_id: ORG_IDS.globex,
      role_id: ROLE_IDS.globex_member,
      joined_at: "2025-02-06T15:00:00.000Z",
    },
    {
      user_id: USER_IDS.sudo_sam,
      org_id: ORG_IDS.globex,
      role_id: ROLE_IDS.globex_admin,
      joined_at: "2025-02-07T16:00:00.000Z",
    },
  ]

  // Clear existing memberships and insert fresh data
  await knex("org_members").del()
  await knex("org_members").insert(orgMembers)
}
