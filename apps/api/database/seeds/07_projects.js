/**
 * Seed: Projects.
 *
 * Creates 3 test projects distributed across the 2 organizations:
 *
 * Acme Corp:
 *   - Backend API          — created by john.doe
 *   - Frontend Dashboard   — created by jane.doe
 *
 * Globex Corporation:
 *   - Infrastructure       — created by CloudArchitect
 *
 * Projects serve as the container for todos and project-level
 * memberships. They are the mid-tier of the org > project > todo
 * hierarchy.
 *
 * @module seeds/07_projects
 */

import { USER_IDS } from "./02_users.js"
import { ORG_IDS } from "./03_organizations.js"

/**
 * Deterministic project UUIDs for cross-seed referencing.
 * Pattern: d0000000-0000-0000-0000-00000000NNNN
 *
 * @type {Record<string, string>}
 */
export const PROJECT_IDS = {
  backend_api: "d0000000-0000-0000-0000-000000000001",
  frontend_dashboard: "d0000000-0000-0000-0000-000000000002",
  infrastructure: "d0000000-0000-0000-0000-000000000003",
}

/**
 * Seed the projects table with 3 test projects.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const projects = [
    // ── Acme Corp projects ──────────────────────────────────────────
    {
      id: PROJECT_IDS.backend_api,
      org_id: ORG_IDS.acme,
      name: "Backend API",
      description:
        "Core REST API service powering the Acme platform. Handles authentication, data processing, and third-party integrations.",
      created_by: USER_IDS.john_doe,
      created_at: "2025-02-10T09:00:00.000Z",
      updated_at: "2025-02-10T09:00:00.000Z",
    },
    {
      id: PROJECT_IDS.frontend_dashboard,
      org_id: ORG_IDS.acme,
      name: "Frontend Dashboard",
      description:
        "React-based dashboard for managing products, users, and analytics. Consumes the Backend API.",
      created_by: USER_IDS.jane_doe,
      created_at: "2025-02-12T10:00:00.000Z",
      updated_at: "2025-02-12T10:00:00.000Z",
    },

    // ── Globex Corporation projects ─────────────────────────────────
    {
      id: PROJECT_IDS.infrastructure,
      org_id: ORG_IDS.globex,
      name: "Infrastructure",
      description:
        "Cloud infrastructure management using Terraform, Kubernetes, and AWS. Covers all environments.",
      created_by: USER_IDS.cloud,
      created_at: "2025-02-15T14:00:00.000Z",
      updated_at: "2025-02-15T14:00:00.000Z",
    },
  ]

  // Clear existing projects and insert fresh data
  await knex("projects").del()
  await knex("projects").insert(projects)
}
