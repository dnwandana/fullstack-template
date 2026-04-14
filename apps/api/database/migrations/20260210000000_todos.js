/**
 * Migration: Create the `todos` table.
 *
 * Todos are the core work items, now scoped to projects rather than
 * directly to users. Each todo belongs to a project and tracks the
 * user who created/owns it.
 *
 * Two indexes are created for common query patterns:
 *   - (project_id)           — list all todos in a project
 *   - (project_id, user_id)  — list a user's todos within a project
 *
 * Columns:
 *   - id           UUID primary key
 *   - project_id   FK to projects.id (CASCADE delete)
 *   - user_id      FK to users.id — the todo owner/creator
 *   - title        short summary of the todo
 *   - description  optional detailed description
 *   - is_completed whether the todo has been marked done
 *   - created_at   timezone-aware creation timestamp
 *   - updated_at   timezone-aware last-update timestamp
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("todos", (table) => {
    // Primary key
    table.uuid("id").primary()

    // The project this todo belongs to
    table.uuid("project_id").notNullable()
    table.foreign("project_id").references("id").inTable("projects").onDelete("CASCADE")

    // The user who created/owns this todo
    table.uuid("user_id").notNullable()
    table.foreign("user_id").references("id").inTable("users")

    // Short summary of the task
    table.string("title").notNullable()

    // Optional detailed description
    table.text("description").nullable()

    // Completion status — defaults to not completed
    table.boolean("is_completed").notNullable().defaultTo(false)

    // Timezone-aware timestamps
    table.timestamps(true, true)

    // Index for listing all todos in a project
    table.index("project_id")

    // Composite index for listing a user's todos within a project
    table.index(["project_id", "user_id"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("todos")
}
