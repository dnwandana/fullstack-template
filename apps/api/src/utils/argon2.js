import argon2 from "argon2"

/**
 * Hashes a plain-text password using the Argon2 algorithm.
 *
 * @param {string} plainPassword - The password in plain text to be hashed.
 * @returns {Promise<string>} A promise that resolves to the generated hash.
 */
export const hashPassword = async (plainPassword) => {
  return await argon2.hash(plainPassword)
}

/**
 * Verifies a plain-text password against a previously generated Argon2 hash.
 *
 * @param {string} hashedPassword - The Argon2-hashed password to verify against.
 * @param {string} plainPassword  - The plain-text password to check.
 * @returns {Promise<boolean>} A promise that resolves to boolean if the plainPassword matches the hashedPassword.
 */
export const verifyPassword = async (hashedPassword, plainPassword) => {
  return await argon2.verify(hashedPassword, plainPassword)
}
