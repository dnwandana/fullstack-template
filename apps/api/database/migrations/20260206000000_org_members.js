/**
 * Migration: Create the `org_members` join table.
 *
 * Tracks which users belong to which organizations and in what role.
 * Uses a composite primary key (user_id, org_id) — a user can only
 * have one role per organization.
 *
 * CASCADE deletes on user, org, and role ensure clean removal when
 * parent records are deleted (e.g., org deletion cascading through
 * roles). The application layer still guards against directly
 * deleting roles that are in use.
 *
 * Columns:
 *   - user_id    FK to users.id (CASCADE delete)
 *   - org_id     FK to organizations.id (CASCADE delete)
 *   - role_id    FK to roles.id (CASCADE delete) — the member's role within the org
 *   - joined_at  timestamp recording when the user joined the org
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("org_members", (table) => {
    // The user who is a member
    table.uuid("user_id").notNullable()
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE")

    // The organization they belong to
    table.uuid("org_id").notNullable()
    table.foreign("org_id").references("id").inTable("organizations").onDelete("CASCADE")

    // The role assigned to this member within the org
    table.uuid("role_id").notNullable()
    table.foreign("role_id").references("id").inTable("roles").onDelete("CASCADE")

    // When the user joined the organization
    table.timestamp("joined_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())

    // A user can only appear once per organization
    table.primary(["user_id", "org_id"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("org_members")
}
