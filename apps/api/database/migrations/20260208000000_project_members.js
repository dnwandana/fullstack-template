/**
 * Migration: Create the `project_members` join table.
 *
 * Tracks which users belong to which projects and in what role.
 * Uses a composite primary key (user_id, project_id) — a user can
 * only have one role per project.
 *
 * CASCADE deletes on user, project, and role ensure clean removal
 * when parent records are deleted (e.g., org deletion cascading
 * through roles). The application layer still guards against
 * directly deleting roles that are in use.
 *
 * Columns:
 *   - user_id     FK to users.id (CASCADE delete)
 *   - project_id  FK to projects.id (CASCADE delete)
 *   - role_id     FK to roles.id (CASCADE delete) — the member's role within the project
 *   - joined_at   timestamp recording when the user joined the project
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("project_members", (table) => {
    // The user who is a project member
    table.uuid("user_id").notNullable()
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE")

    // The project they belong to
    table.uuid("project_id").notNullable()
    table.foreign("project_id").references("id").inTable("projects").onDelete("CASCADE")

    // The role assigned to this member within the project
    table.uuid("role_id").notNullable()
    table.foreign("role_id").references("id").inTable("roles").onDelete("CASCADE")

    // When the user joined the project
    table.timestamp("joined_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())

    // A user can only appear once per project
    table.primary(["user_id", "project_id"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("project_members")
}
