/**
 * Migration: Create the `invitations` table.
 *
 * Invitations allow org members to invite others to join an organization
 * or a specific project. An invitation can target either an email address
 * (for users not yet registered) or an existing user by ID.
 *
 * The `token_hash` column stores the SHA-256 hash of the invitation token.
 * The raw token is shown only once at creation and never stored. The
 * `expires_at` timestamp enforces time-limited acceptance.
 *
 * Columns:
 *   - id            UUID primary key
 *   - org_id        FK to organizations.id (CASCADE delete)
 *   - project_id    FK to projects.id (CASCADE delete) — nullable for org-level invites
 *   - inviter_id    FK to users.id (SET NULL on delete) — who sent the invitation
 *   - invitee_email email of the person being invited (nullable if invitee_id is set)
 *   - invitee_id    FK to users.id (SET NULL on delete) — existing user being invited (nullable if email is set)
 *   - role_id       FK to roles.id (RESTRICT delete) — the role granted upon acceptance
 *   - status        invitation state: "pending", "accepted", "declined", "expired"
 *   - token_hash    SHA-256 hash of the invitation token (nullable, cleared after use)
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
    table.foreign("inviter_id").references("id").inTable("users").onDelete("SET NULL")

    // Target: either an email (for new users) or a user ID (for existing users)
    table.string("invitee_email", 255).nullable()
    table.uuid("invitee_id").nullable()
    table.foreign("invitee_id").references("id").inTable("users").onDelete("SET NULL")

    // The role that will be assigned when the invitation is accepted
    table.uuid("role_id").notNullable()
    table.foreign("role_id").references("id").inTable("roles").onDelete("RESTRICT")

    // Current status of the invitation
    table.string("status", 20).notNullable().defaultTo("pending")

    // SHA-256 hash of the invitation token — raw token shown only once at creation
    table.string("token_hash", 64).nullable().unique()

    // When this invitation expires and can no longer be accepted
    table.timestamp("expires_at", { useTz: true }).notNullable()

    // Timezone-aware timestamps
    table.timestamps(true, true)

    // Index for listing invitations by organization
    table.index("org_id")

    // Index for finding pending invitations for a specific user
    table.index("invitee_id")

    // Composite index for filtering pending + not-expired invitations
    table.index(["status", "expires_at"])
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("invitations")
}
