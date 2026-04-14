import db from "../config/database.js"

const TABLE_NAME = "organizations"
const COLUMNS = ["id", "name", "description", "created_by", "created_at", "updated_at"]

/**
 * Insert a new organization into the database.
 *
 * @param {Object} org - Organization data to insert
 * @param {string} org.name - Organization name
 * @param {string} [org.description] - Organization description
 * @param {string} org.created_by - UUID of the user creating the organization
 * @returns {Promise<Object[]>} Array containing the newly created organization
 */
export const create = (org) => {
  return db.insert(org).into(TABLE_NAME).returning(COLUMNS)
}

/**
 * Find a single organization matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id })
 * @returns {Promise<Object|undefined>} The matched organization or undefined
 */
export const findOne = (conditions) => {
  return db.select(COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find all organizations a user belongs to by joining the org_members table.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<Object[]>} Array of organizations the user is a member of
 */
export const findManyByUserId = (userId) => {
  return db
    .select(COLUMNS.map((col) => `${TABLE_NAME}.${col}`))
    .from(TABLE_NAME)
    .join("org_members", `${TABLE_NAME}.id`, "org_members.org_id")
    .where("org_members.user_id", userId)
}

/**
 * Update an organization matching the given conditions.
 *
 * @param {Object} conditions - Key-value pairs to identify the organization
 * @param {Object} data - Fields to update (e.g., { name, description })
 * @returns {Promise<Object[]>} Array containing the updated organization
 */
export const update = (conditions, data) => {
  return db.update(data).from(TABLE_NAME).where(conditions).returning(COLUMNS)
}

/**
 * Delete an organization matching the given conditions.
 * Related records (members, projects, etc.) are removed via CASCADE.
 *
 * @param {Object} conditions - Key-value pairs to identify the organization
 * @returns {Promise<number>} Number of rows deleted
 */
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
