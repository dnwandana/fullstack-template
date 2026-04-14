import db from "../config/database.js"

const TABLE_NAME = "roles"
const COLUMNS = ["id", "org_id", "name", "description", "is_system", "created_at", "updated_at"]

/**
 * Insert a new role into the database.
 *
 * @param {Object} role - Role data to insert
 * @param {string} role.org_id - UUID of the organization this role belongs to
 * @param {string} role.name - Role name (e.g., "admin", "member")
 * @param {string} [role.description] - Role description
 * @param {boolean} [role.is_system] - Whether this is a system-defined role
 * @returns {Promise<Object[]>} Array containing the newly created role
 */
export const create = (role) => {
  return db.insert(role).into(TABLE_NAME).returning(COLUMNS)
}

/**
 * Find a single role matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id, org_id })
 * @returns {Promise<Object|undefined>} The matched role or undefined
 */
export const findOne = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all roles matching the given conditions, ordered by name.
 *
 * @param {Object} conditions - Key-value pairs to filter by (e.g., { org_id })
 * @returns {Promise<Object[]>} Array of matched roles
 */
export const findMany = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).orderBy("name")
}

/**
 * Update a role matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the role
 * @param {Object} data - Fields to update (e.g., { name, description })
 * @returns {Promise<Object[]>} Array containing the updated role
 */
export const update = (conditions, data) => {
  return db.update(data).from(TABLE_NAME).where(conditions).returning(COLUMNS)
}

/**
 * Delete a role matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the role
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}

/**
 * Find all permissions assigned to a role by joining role_permissions and permissions.
 *
 * @param {string} roleId - UUID of the role
 * @returns {Promise<Object[]>} Array of permissions with id, name, resource, and action
 */
export const findPermissionsByRoleId = (roleId) => {
  return db
    .select("permissions.id", "permissions.name", "permissions.resource", "permissions.action")
    .from("role_permissions")
    .join("permissions", "role_permissions.permission_id", "permissions.id")
    .where("role_permissions.role_id", roleId)
}

/**
 * Replace all permissions for a role in a single transaction.
 * Deletes existing role_permissions rows, then bulk-inserts the new set.
 * Handles the case where permissionIds is empty (removes all permissions).
 *
 * @param {string} roleId - UUID of the role
 * @param {string[]} permissionIds - Array of permission UUIDs to assign
 * @returns {Promise<void>}
 */
export const setPermissions = (roleId, permissionIds) => {
  return db.transaction(async (trx) => {
    // Remove all existing permissions for this role
    await trx("role_permissions").where("role_id", roleId).delete()

    // Only insert if there are permissions to add
    if (permissionIds.length > 0) {
      const rows = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }))
      await trx("role_permissions").insert(rows)
    }
  })
}
