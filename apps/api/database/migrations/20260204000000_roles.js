/**
 * Migration: Create the `roles` table.
 *
 * Roles are scoped to an organization. Each org has its own set of roles
 * (e.g. owner, admin, member, viewer). System-created roles have
 * `is_system = true` and should not be deleted or renamed by users.
 *
 * The UNIQUE(org_id, name) constraint prevents duplicate role names
 * within the same organization.
 *
 * Columns:
 *   - id          UUID primary key
 *   - org_id      FK to organizations.id — the owning organization
 *   - name        role name within the org (max 50 chars)
 *   - description optional explanation of the role
 *   - is_system   whether this role was auto-created (protected from deletion)
 *   - created_at  timezone-aware creation timestamp
 *   - updated_at  timezone-aware last-update timestamp
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("roles", (table) => {
    // Primary key
    table.uuid("id").primary()

    // The organization this role belongs to
    table.uuid("org_id").notNullable()
    table.foreign("org_id").references("id").inTable("organizations").onDelete("CASCADE")

    // Role name — unique per organization
    table.string("name", 50).notNullable()

    // Optional description of the role's purpose
    table.text("description").nullable()

    // System-created roles are protected from user modification
    table.boolean("is_system").notNullable().defaultTo(false)

    // Timezone-aware timestamps
    table.timestamps(true, true)

    // Prevent duplicate role names within the same org
    table.unique(["org_id", "name"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("roles")
}
