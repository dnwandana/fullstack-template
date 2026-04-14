/**
 * Migration: Create the `permissions` table.
 *
 * Permissions define granular actions a user can perform on a resource.
 * They are system-level (not org-scoped) and assigned to roles via
 * the `role_permissions` join table.
 *
 * The UNIQUE(resource, action) constraint ensures no duplicate
 * permission definitions exist.
 *
 * Columns:
 *   - id          UUID primary key
 *   - name        human-readable label (e.g. "Create Project")
 *   - description optional explanation of what this permission grants
 *   - resource    the entity being protected (e.g. "org", "project", "todos")
 *   - action      the operation allowed (e.g. "create", "read", "delete")
 *   - created_at  timezone-aware creation timestamp (no updated_at — permissions are immutable)
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("permissions", (table) => {
    // Primary key
    table.uuid("id").primary()

    // Human-readable permission name (must be unique)
    table.string("name", 100).notNullable().unique()

    // Optional description of what the permission grants
    table.text("description").nullable()

    // The resource this permission applies to (e.g. "org", "project", "todos")
    table.string("resource", 50).notNullable()

    // The action allowed on the resource (e.g. "create", "read", "update", "delete")
    table.string("action", 50).notNullable()

    // Creation timestamp only — permissions are immutable once created
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())

    // Prevent duplicate resource+action combinations
    table.unique(["resource", "action"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("permissions")
}
