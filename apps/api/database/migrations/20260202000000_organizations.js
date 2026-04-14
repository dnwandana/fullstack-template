/**
 * Migration: Create the `organizations` table.
 *
 * Organizations are the top-level tenant boundary. Every project,
 * role, and membership is scoped to an organization. The `created_by`
 * column tracks which user originally created the org.
 *
 * Columns:
 *   - id          UUID primary key
 *   - name        display name (max 100 chars)
 *   - description optional longer description
 *   - created_by  FK to users.id — the founding user
 *   - created_at  timezone-aware creation timestamp
 *   - updated_at  timezone-aware last-update timestamp
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("organizations", (table) => {
    // Primary key
    table.uuid("id").primary()

    // Organization display name
    table.string("name", 100).notNullable()

    // Optional longer description of the organization
    table.text("description").nullable()

    // The user who created this organization
    table.uuid("created_by").notNullable()
    table.foreign("created_by").references("id").inTable("users")

    // Timezone-aware timestamps
    table.timestamps(true, true)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("organizations")
}
