import db from "../config/database.js"

const TABLE_NAME = "users"
const SAFE_COLUMNS = ["id", "username", "email", "created_at", "updated_at"]

/**
 * Insert a new user into the database.
 *
 * @param {Object} user - User data to insert
 * @param {string} user.username - Unique username
 * @param {string} user.email - User email address
 * @param {string} user.password - Hashed password
 * @returns {Promise<Object[]>} Array containing the newly created user (safe columns only)
 */
export const create = (user) => {
  return db.insert(user).into(TABLE_NAME).returning(SAFE_COLUMNS)
}

/**
 * Find a single user by conditions, returning only safe (non-sensitive) columns.
 *
 * @param {Object} conditions - Key-value pairs to match against (e.g., { id }, { username })
 * @returns {Promise<Object|undefined>} The matched user or undefined
 */
export const findOne = (conditions) => {
  return db.select(SAFE_COLUMNS).from(TABLE_NAME).where(conditions).first()
}

/**
 * Find a single user by conditions, including the password hash.
 * Used only for authentication — never expose the result directly in API responses.
 *
 * @param {Object} conditions - Key-value pairs to match against
 * @returns {Promise<Object|undefined>} The matched user with all columns, or undefined
 */
export const findOneWithPassword = (conditions) => {
  return db.select("*").from(TABLE_NAME).where(conditions).first()
}
