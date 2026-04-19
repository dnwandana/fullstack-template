import crypto from "node:crypto"
import db from "../config/database.js"

const TABLE_NAME = "refresh_tokens"

/**
 * Hashes a raw refresh token with SHA-256 for secure storage.
 *
 * @param {string} rawToken - The raw JWT refresh token string
 * @returns {string} Hex-encoded SHA-256 hash
 */
export const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

/**
 * Store a new refresh token record in the database.
 *
 * @param {Object} data - Token data to insert
 * @param {string} data.user_id - UUID of the user this token belongs to
 * @param {string} data.token_hash - SHA-256 hash of the refresh token
 * @param {Date} data.expires_at - When this refresh token expires
 * @returns {Promise<Object[]>} Array containing the newly created token record
 */
export const create = (data) => {
  return db
    .insert({
      id: crypto.randomUUID(),
      user_id: data.user_id,
      token_hash: data.token_hash,
      expires_at: data.expires_at,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .into(TABLE_NAME)
    .returning(["id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at"])
}

/**
 * Find an active (non-revoked) refresh token by its hash.
 *
 * @param {string} tokenHash - SHA-256 hash of the refresh token
 * @returns {Promise<Object|undefined>} The matched token record or undefined
 */
export const findActiveByHash = (tokenHash) => {
  return db
    .select("*")
    .from(TABLE_NAME)
    .where({ token_hash: tokenHash })
    .whereNull("revoked_at")
    .first()
}

/**
 * Revoke a refresh token by setting its revoked_at timestamp.
 *
 * @param {string} id - UUID of the refresh token record
 * @returns {Promise<number>} Number of rows updated
 */
export const revokeById = (id) => {
  return db
    .update({ revoked_at: new Date(), updated_at: new Date() })
    .from(TABLE_NAME)
    .where({ id })
}

/**
 * Revoke all active refresh tokens for a given user.
 * Used when a user changes password or requests full logout.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<number>} Number of tokens revoked
 */
export const revokeAllForUser = (userId) => {
  return db
    .update({ revoked_at: new Date(), updated_at: new Date() })
    .from(TABLE_NAME)
    .where({ user_id: userId })
    .whereNull("revoked_at")
}

/**
 * Permanently delete old refresh tokens that are either revoked or expired.
 *
 * @param {Date} [olderThan=new Date()] - Cutoff date — tokens older than this are purged
 * @returns {Promise<number>} Number of rows deleted
 */
export const purgeOld = (olderThan = new Date()) => {
  return db
    .del()
    .from(TABLE_NAME)
    .where("revoked_at", "<", olderThan)
    .orWhere("expires_at", "<", olderThan)
}
