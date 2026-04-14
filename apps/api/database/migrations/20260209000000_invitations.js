/**
 * Migration: Create the `invitations` table.
 *
 * Invitations allow org members to invite others to join an organization
 * or a specific project. An invitation can target either an email address
 * (for users not yet registered) or an existing user by ID.
 *
 * The `token` column holds a unique, URL-safe token used in invitation
 * links. The `expires_at` timestamp enforces time-limited acceptance.
 *
 * Columns:
 *   - id            UUID primary key
 *   - org_id        FK to organizations.id (CASCADE delete)
 *   - project_id    FK to projects.id (CASCADE delete) — nullable for org-level invites
 *   - inviter_id    FK to users.id — who sent the invitation
 *   - invitee_email email of the person being invited (nullable if invitee_id is set)
 *   - invitee_id    FK to users.id — existing user being invited (nullable if email is set)
 *   - role_id       FK to roles.id — the role granted upon acceptance
 *   - status        invitation state: "pending", "accepted", "declined", "expired"
 *   - token         unique URL-safe token for the invitation link
 *   - expires_at    when the invitation becomes invalid
 *   - created_at    timezone-aware creation timestamp
 *   - updated_at    timezone-aware last-update timestamp
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("invitations", (table) => {
    // Primary key
    table.uuid("id").primary()

    // The organization this invitation is for
    table.uuid("org_id").notNullable()
    table.foreign("org_id").references("id").inTable("organizations").onDelete("CASCADE")

    // Optional project scope — null means org-level invitation
    table.uuid("project_id").nullable()
    table.foreign("project_id").references("id").inTable("projects").onDelete("CASCADE")

    // The user who created and sent this invitation
    table.uuid("inviter_id").notNullable()
    table.foreign("inviter_id").references("id").inTable("users")

    // Target: either an email (for new users) or a user ID (for existing users)
    table.string("invitee_email", 255).nullable()
    table.uuid("invitee_id").nullable()
    table.foreign("invitee_id").references("id").inTable("users")

    // The role that will be assigned when the invitation is accepted
    table.uuid("role_id").notNullable()
    table.foreign("role_id").references("id").inTable("roles")

    // Current status of the invitation
    table.string("status", 20).notNullable().defaultTo("pending")

    // Unique token used in the invitation link URL
    table.string("token", 255).notNullable().unique()

    // When this invitation expires and can no longer be accepted
    table.timestamp("expires_at", { useTz: true }).notNullable()

    // Timezone-aware timestamps
    table.timestamps(true, true)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("invitations")
}
