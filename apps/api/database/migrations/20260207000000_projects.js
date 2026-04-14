/**
 * Migration: Create the `projects` table.
 *
 * Projects live inside organizations and serve as the container for
 * todos and project-level memberships. Each project tracks who created
 * it via `created_by`.
 *
 * CASCADE delete on org_id means deleting an organization removes
 * all its projects (and transitively, all todos within them).
 *
 * Columns:
 *   - id          UUID primary key
 *   - org_id      FK to organizations.id (CASCADE delete)
 *   - name        project display name (max 100 chars)
 *   - description optional longer description
 *   - created_by  FK to users.id — the user who created the project
 *   - created_at  timezone-aware creation timestamp
 *   - updated_at  timezone-aware last-update timestamp
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("projects", (table) => {
    // Primary key
    table.uuid("id").primary()

    // The organization this project belongs to
    table.uuid("org_id").notNullable()
    table.foreign("org_id").references("id").inTable("organizations").onDelete("CASCADE")

    // Project display name
    table.string("name", 100).notNullable()

    // Optional longer description
    table.text("description").nullable()

    // The user who created this project
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
  return knex.schema.dropTable("projects")
}
