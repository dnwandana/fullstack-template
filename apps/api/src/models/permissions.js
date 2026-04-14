import db from "../config/database.js"

const TABLE_NAME = "permissions"
const COLUMNS = ["id", "name", "description", "resource", "action"]

/**
 * Retrieve all permissions ordered by resource then action.
 * Permissions are system-defined and seeded — this returns the full set.
 *
 * @returns {Promise<Object[]>} Array of all permissions
 */
export const findAll = () => {
  return db.select(COLUMNS).from(TABLE_NAME).orderBy("resource").orderBy("action")
}

/**
 * Find a single permission matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { name })
 * @returns {Promise<Object|undefined>} The matched permission or undefined
 */
export const findOne = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find multiple permissions by their IDs.
 *
 * @param {string[]} ids - Array of permission UUIDs to look up
 * @returns {Promise<Object[]>} Array of matched permissions
 */
export const findByIds = (ids) => {
  return db.select(COLUMNS).from(TABLE_NAME).whereIn("id", ids)
}
