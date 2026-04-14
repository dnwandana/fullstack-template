import jwt from "jsonwebtoken"

/**
 * Generates a signed JSON Web Token for a given user.
 *
 * @param {string|number} id The unique identifier of the user.
 * @returns {string} A signed JWT string.
 */
export const generateAccessToken = (id) => {
  const jwtPayload = {
    id,
    type: "access",
  }

  return jwt.sign(jwtPayload, process.env.ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  })
}

/**
 * Generates a refresh token for a given user.
 *
 * @param {string|number} id The unique identifier of the user.
 * @returns {string} A signed refresh token string.
 */
export const generateRefreshToken = (id) => {
  const jwtPayload = {
    id,
    type: "refresh",
  }

  return jwt.sign(jwtPayload, process.env.REFRESH_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  })
}

/**
 * Verifies and decodes a JSON Web Token.
 *
 * @param {string} token The JWT string to verify.
 * @returns {Object} The decoded token payload.
 * @throws {Error} If verification fails (e.g., token expired, invalid signature, missing secret).
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
    algorithms: ["HS256"],
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  })
}

/**
 * Verifies and decodes a refresh token.
 *
 * @param {string} token The refresh token string to verify.
 * @returns {Object} The decoded token payload.
 * @throws {Error} If verification fails (e.g., token expired, invalid signature, missing secret).
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
    algorithms: ["HS256"],
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  })
}
