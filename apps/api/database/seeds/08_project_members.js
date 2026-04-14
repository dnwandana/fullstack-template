/**
 * Seed: Project memberships.
 *
 * Assigns users to projects with roles inherited from their org context.
 * Project roles use the same org-scoped role IDs (a user's project role
 * must come from the same org the project belongs to).
 *
 * Backend API (Acme):
 *   - john.doe        → owner   (project creator)
 *   - jane.doe        → admin   (co-lead)
 *   - AlexTheBuilder  → member  (contributor)
 *
 * Frontend Dashboard (Acme):
 *   - jane.doe        → owner   (project creator)
 *   - john.doe        → member  (backend support)
 *   - AlexTheBuilder  → member  (contributor)
 *   - sudo_sam        → viewer  (observer)
 *
 * Infrastructure (Globex):
 *   - CloudArchitect  → owner   (project creator)
 *   - AlexTheBuilder  → member  (cross-org contributor)
 *   - sudo_sam        → admin   (Globex admin)
 *
 * @module seeds/08_project_members
 */

import { USER_IDS } from "./02_users.js"
import { ROLE_IDS } from "./04_roles.js"
import { PROJECT_IDS } from "./07_projects.js"

/**
 * Seed the project_members table with user-project-role mappings.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const projectMembers = [
    // ── Backend API (Acme Corp) ─────────────────────────────────────
    {
      user_id: USER_IDS.john_doe,
      project_id: PROJECT_IDS.backend_api,
      role_id: ROLE_IDS.acme_owner,
      joined_at: "2025-02-10T09:00:00.000Z",
    },
    {
      user_id: USER_IDS.jane_doe,
      project_id: PROJECT_IDS.backend_api,
      role_id: ROLE_IDS.acme_admin,
      joined_at: "2025-02-10T10:00:00.000Z",
    },
    {
      user_id: USER_IDS.alex,
      project_id: PROJECT_IDS.backend_api,
      role_id: ROLE_IDS.acme_member,
      joined_at: "2025-02-11T11:00:00.000Z",
    },

    // ── Frontend Dashboard (Acme Corp) ──────────────────────────────
    {
      user_id: USER_IDS.jane_doe,
      project_id: PROJECT_IDS.frontend_dashboard,
      role_id: ROLE_IDS.acme_owner,
      joined_at: "2025-02-12T10:00:00.000Z",
    },
    {
      user_id: USER_IDS.john_doe,
      project_id: PROJECT_IDS.frontend_dashboard,
      role_id: ROLE_IDS.acme_member,
      joined_at: "2025-02-12T11:00:00.000Z",
    },
    {
      user_id: USER_IDS.alex,
      project_id: PROJECT_IDS.frontend_dashboard,
      role_id: ROLE_IDS.acme_member,
      joined_at: "2025-02-13T09:00:00.000Z",
    },
    {
      user_id: USER_IDS.sudo_sam,
      project_id: PROJECT_IDS.frontend_dashboard,
      role_id: ROLE_IDS.acme_viewer,
      joined_at: "2025-02-14T10:00:00.000Z",
    },

    // ── Infrastructure (Globex Corporation) ─────────────────────────
    {
      user_id: USER_IDS.cloud,
      project_id: PROJECT_IDS.infrastructure,
      role_id: ROLE_IDS.globex_owner,
      joined_at: "2025-02-15T14:00:00.000Z",
    },
    {
      user_id: USER_IDS.alex,
      project_id: PROJECT_IDS.infrastructure,
      role_id: ROLE_IDS.globex_member,
      joined_at: "2025-02-16T10:00:00.000Z",
    },
    {
      user_id: USER_IDS.sudo_sam,
      project_id: PROJECT_IDS.infrastructure,
      role_id: ROLE_IDS.globex_admin,
      joined_at: "2025-02-17T11:00:00.000Z",
    },
  ]

  // Clear existing project memberships and insert fresh data
  await knex("project_members").del()
  await knex("project_members").insert(projectMembers)
}
