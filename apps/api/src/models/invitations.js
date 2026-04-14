import db from "../config/database.js"

const TABLE_NAME = "invitations"
const COLUMNS = [
  "id",
  "org_id",
  "project_id",
  "inviter_id",
  "invitee_email",
  "invitee_id",
  "role_id",
  "status",
  "token",
  "expires_at",
  "created_at",
  "updated_at",
]

/**
 * Insert a new invitation into the database.
 *
 * @param {Object} invitation - Invitation data to insert
 * @param {string} invitation.org_id - UUID of the organization
 * @param {string} [invitation.project_id] - UUID of the project (null for org-level invitations)
 * @param {string} invitation.inviter_id - UUID of the user sending the invitation
 * @param {string} invitation.invitee_email - Email address of the invitee
 * @param {string} [invitation.invitee_id] - UUID of the invitee if they already have an account
 * @param {string} invitation.role_id - UUID of the role to assign upon acceptance
 * @param {string} invitation.token - Unique invitation token
 * @param {Date} invitation.expires_at - When this invitation expires
 * @returns {Promise<Object[]>} Array containing the newly created invitation
 */
export const create = (invitation) => {
  return db.insert(invitation).into(TABLE_NAME).returning(COLUMNS)
}

/**
 * Find a single invitation matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id }, { token })
 * @returns {Promise<Object|undefined>} The matched invitation or undefined
 */
export const findOne = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all invitations for an organization with inviter/invitee usernames and role names.
 * Left-joins users as invitee because the invitee may not have an account yet.
 * Ordered by most recent first.
 *
 * @param {string} orgId - UUID of the organization
 * @returns {Promise<Object[]>} Array of enriched invitation records
 */
export const findManyByOrgId = (orgId) => {
  return db
    .select(
      `${TABLE_NAME}.*`,
      "inviter.username as inviter_username",
      "invitee.username as invitee_username",
      "roles.name as role_name",
    )
    .from(TABLE_NAME)
    .join("users as inviter", `${TABLE_NAME}.inviter_id`, "inviter.id")
    .leftJoin("users as invitee", `${TABLE_NAME}.invitee_id`, "invitee.id")
    .join("roles", `${TABLE_NAME}.role_id`, "roles.id")
    .where(`${TABLE_NAME}.org_id`, orgId)
    .orderBy(`${TABLE_NAME}.created_at`, "desc")
}

/**
 * Find all pending invitations for a specific user (by invitee_id).
 * Joins organizations, projects, inviter user, and roles to provide full context.
 * Only returns invitations that are still pending and have not expired.
 *
 * @param {string} userId - UUID of the invitee user
 * @returns {Promise<Object[]>} Array of pending invitations with org/project/inviter details
 */
export const findPendingByUserId = (userId) => {
  return db
    .select(
      `${TABLE_NAME}.*`,
      "organizations.name as org_name",
      "projects.name as project_name",
      "inviter.username as inviter_username",
      "roles.name as role_name",
    )
    .from(TABLE_NAME)
    .join("organizations", `${TABLE_NAME}.org_id`, "organizations.id")
    .leftJoin("projects", `${TABLE_NAME}.project_id`, "projects.id")
    .join("users as inviter", `${TABLE_NAME}.inviter_id`, "inviter.id")
    .join("roles", `${TABLE_NAME}.role_id`, "roles.id")
    .where(`${TABLE_NAME}.invitee_id`, userId)
    .andWhere(`${TABLE_NAME}.status`, "pending")
    .andWhere(`${TABLE_NAME}.expires_at`, ">", db.fn.now())
    .orderBy(`${TABLE_NAME}.created_at`, "desc")
}

/**
 * Find all pending, non-expired invitations for a given email address.
 * Used to look up invitations for users who may not have an account yet.
 *
 * @param {string} email - Email address of the invitee
 * @returns {Promise<Object[]>} Array of matching invitation records
 */
export const findPendingByEmail = (email) => {
  return db
    .select(COLUMNS)
    .from(TABLE_NAME)
    .where("invitee_email", email)
    .andWhere("status", "pending")
    .andWhere("expires_at", ">", db.fn.now())
}

/**
 * Update an invitation matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the invitation
 * @param {Object} data - Fields to update (e.g., { status: "accepted" })
 * @returns {Promise<Object[]>} Array containing the updated invitation
 */
export const update = (conditions, data) => {
  return db.update(data).from(TABLE_NAME).where(conditions).returning(COLUMNS)
}

/**
 * Delete an invitation matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the invitation
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
