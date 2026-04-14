/**
 * Migration: Create the `role_permissions` join table.
 *
 * Maps roles to their granted permissions. Uses a composite primary key
 * (role_id, permission_id) to prevent duplicates and avoid needing a
 * surrogate key. Both FKs cascade on delete — removing a role or
 * permission automatically cleans up the mapping.
 *
 * Columns:
 *   - role_id       FK to roles.id (CASCADE delete)
 *   - permission_id FK to permissions.id (CASCADE delete)
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("role_permissions", (table) => {
    // Role that receives the permission
    table.uuid("role_id").notNullable()
    table.foreign("role_id").references("id").inTable("roles").onDelete("CASCADE")

    // Permission being granted to the role
    table.uuid("permission_id").notNullable()
    table.foreign("permission_id").references("id").inTable("permissions").onDelete("CASCADE")

    // Composite primary key prevents duplicate assignments
    table.primary(["role_id", "permission_id"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("role_permissions")
}
