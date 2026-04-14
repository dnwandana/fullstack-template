import db from "../config/database.js"

const TABLE_NAME = "org_members"

/**
 * Insert a new organization membership record.
 *
 * @param {Object} member - Membership data to insert
 * @param {string} member.org_id - UUID of the organization
 * @param {string} member.user_id - UUID of the user
 * @param {string} member.role_id - UUID of the role assigned to this member
 * @returns {Promise<Object[]>} Array containing the newly created membership
 */
export const create = (member) => {
  return db.insert(member).into(TABLE_NAME)
}

/**
 * Find a single organization membership matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { user_id, org_id })
 * @returns {Promise<Object|undefined>} The matched membership or undefined
 */
export const findOne = (conditions) => {
  return db.select("*").from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all members of an organization with their user details and role names.
 * Joins users and roles tables to enrich the membership data.
 *
 * @param {string} orgId - UUID of the organization
 * @returns {Promise<Object[]>} Array of members with user_id, org_id, role_id,
 *   joined_at, username, email, and role_name
 */
export const findManyByOrgId = (orgId) => {
  return db
    .select(
      `${TABLE_NAME}.user_id`,
      `${TABLE_NAME}.org_id`,
      `${TABLE_NAME}.role_id`,
      `${TABLE_NAME}.joined_at`,
      "users.username",
      "users.email",
      "roles.name as role_name",
    )
    .from(TABLE_NAME)
    .join("users", `${TABLE_NAME}.user_id`, "users.id")
    .join("roles", `${TABLE_NAME}.role_id`, "roles.id")
    .where(`${TABLE_NAME}.org_id`, orgId)
}

/**
 * Find a member's role within an organization.
 * Used to verify membership and retrieve role context for authorization.
 *
 * @param {string} userId - UUID of the user
 * @param {string} orgId - UUID of the organization
 * @returns {Promise<Object|undefined>} Object with role_id and role_name, or undefined
 */
export const findMemberWithPermissions = (userId, orgId) => {
  return db
    .select(`${TABLE_NAME}.role_id`, "roles.name as role_name")
    .from(TABLE_NAME)
    .join("roles", `${TABLE_NAME}.role_id`, "roles.id")
    .where({ [`${TABLE_NAME}.user_id`]: userId, [`${TABLE_NAME}.org_id`]: orgId })
    .first()
}

/**
 * Get all permission names for a user within an organization.
 * Resolves the full chain: org_members -> role_permissions -> permissions.
 *
 * @param {string} userId - UUID of the user
 * @param {string} orgId - UUID of the organization
 * @returns {Promise<Object[]>} Array of objects each containing a permission name
 */
export const getPermissions = (userId, orgId) => {
  return db
    .select("permissions.name")
    .from(TABLE_NAME)
    .join("role_permissions", `${TABLE_NAME}.role_id`, "role_permissions.role_id")
    .join("permissions", "role_permissions.permission_id", "permissions.id")
    .where({ [`${TABLE_NAME}.user_id`]: userId, [`${TABLE_NAME}.org_id`]: orgId })
}

/**
 * Update the role assigned to an organization member.
 *
 * @param {Object} conditions - Key-value pairs to identify the membership (e.g., { user_id, org_id })
 * @param {string} roleId - UUID of the new role to assign
 * @returns {Promise<number>} Number of rows updated
 */
export const updateRole = (conditions, roleId) => {
  return db.update({ role_id: roleId }).from(TABLE_NAME).where(conditions)
}

/**
 * Remove an organization membership matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the membership
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
