/**
 * Seed: Organizations.
 *
 * Creates 2 test organizations representing distinct tenants:
 *   - Acme Corp       — created by john.doe
 *   - Globex Corporation — created by CloudArchitect
 *
 * These organizations serve as the top-level tenant boundary for
 * all downstream entities (roles, projects, todos, memberships).
 *
 * @module seeds/03_organizations
 */

import { USER_IDS } from "./02_users.js"

/**
 * Deterministic organization UUIDs for cross-seed referencing.
 * Pattern: b0000000-0000-0000-0000-00000000NNNN
 *
 * @type {Record<string, string>}
 */
export const ORG_IDS = {
  acme: "b0000000-0000-0000-0000-000000000001",
  globex: "b0000000-0000-0000-0000-000000000002",
}

/**
 * Seed the organizations table with 2 test organizations.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  const organizations = [
    {
      id: ORG_IDS.acme,
      name: "Acme Corp",
      description: "A leading provider of innovative solutions for roadrunner management.",
      created_by: USER_IDS.john_doe,
      created_at: "2025-02-01T09:00:00.000Z",
      updated_at: "2025-02-01T09:00:00.000Z",
    },
    {
      id: ORG_IDS.globex,
      name: "Globex Corporation",
      description: "Global infrastructure and cloud platform engineering company.",
      created_by: USER_IDS.cloud,
      created_at: "2025-02-05T14:00:00.000Z",
      updated_at: "2025-02-05T14:00:00.000Z",
    },
  ]

  // Clear existing organizations and insert fresh data
  await knex("organizations").del()
  await knex("organizations").insert(organizations)
}
