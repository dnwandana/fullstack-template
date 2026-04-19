import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as userModel from "../models/users.js"
import * as refreshTokenModel from "../models/refresh-tokens.js"
import { hashPassword, verifyPassword } from "../utils/argon2.js"
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js"

// Pre-computed dummy hash for timing-safe signin.
// Ensures verifyPassword always runs, even when the user doesn't exist,
// so response times don't reveal whether a username is valid.
const dummyHash = await hashPassword("dummy-timing-safe-password")

const signupSchema = joi
  .object({
    username: joi
      .string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9._-]+$/)
      .required()
      .messages({
        "string.pattern.base":
          "username must contain only letters, numbers, dots, underscores, or hyphens",
      }),
    email: joi.string().email().max(255).optional(),
    password: joi.string().min(8).max(72).required(),
    confirmation_password: joi.string().required().valid(joi.ref("password")).messages({
      "any.only": "confirmation_password must match password",
    }),
  })
  .options({ stripUnknown: true })

const signinSchema = joi
  .object({
    username: joi
      .string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9._-]+$/)
      .required()
      .messages({
        "string.pattern.base":
          "username must contain only letters, numbers, dots, underscores, or hyphens",
      }),
    password: joi.string().min(8).max(72).required(),
  })
  .options({ stripUnknown: true })

/**
 * Parses a duration string (e.g. "15m", "7d") into an absolute expiry Date.
 * Falls back to 7 days from now if the format doesn't match.
 *
 * @param {string} duration - Duration string in the format `<number><unit>` (s/m/h/d)
 * @returns {Date} The absolute expiry timestamp
 */
const parseExpiresIn = (duration) => {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const value = parseInt(match[1])
  const unit = match[2]
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit]
  return new Date(Date.now() + value * ms)
}

/**
 * POST /api/auth/signup — Register a new user.
 * Username must be unique; email is optional but must also be unique if provided.
 * Password is hashed with Argon2 before storage.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const signup = async (req, res, next) => {
  try {
    const { error, value } = signupSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { username, email, password } = value

    const existingUser = await userModel.findOne({ username })
    if (existingUser) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "user with the given username already exists",
      )
    }

    if (email) {
      const existingEmail = await userModel.findOne({ email })
      if (existingEmail) {
        throw new HttpError(
          HTTP_STATUS_CODE.BAD_REQUEST,
          "user with the given email already exists",
        )
      }
    }

    const hashedPassword = await hashPassword(password)

    const userData = {
      id: crypto.randomUUID(),
      username,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (email) userData.email = email

    const [user] = await userModel.create(userData)

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: {
          id: user.id,
          username: user.username,
          email: user.email ?? null,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/auth/signin — Authenticate and obtain tokens.
 * Uses timing-safe credential checking to prevent username enumeration.
 * Issues both an access token and a refresh token; stores the refresh token
 * hash in the database for later rotation/revocation.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const signin = async (req, res, next) => {
  try {
    const { error, value } = signinSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const { username, password } = value

    const user = await userModel.findOneWithPassword({ username })
    const hashToVerify = user?.password ?? dummyHash
    const isPasswordValid = await verifyPassword(hashToVerify, password)
    if (!user || !isPasswordValid) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    const tokenHash = refreshTokenModel.hashToken(refreshToken)
    const expiresAt = parseExpiresIn(process.env.REFRESH_TOKEN_EXPIRES_IN)
    await refreshTokenModel.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: {
          id: user.id,
          username: user.username,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/auth/refresh — Rotate refresh token and issue new access token.
 * Validates the existing refresh token against the database, revokes it,
 * then issues a new access/refresh token pair (rotation pattern).
 *
 * @param {Object} req - Express request object (req.user.id set by requireRefreshToken middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const refreshAccessToken = async (req, res, next) => {
  try {
    const userId = req.user.id

    const rawRefreshToken = req.headers["x-refresh-token"]
    const tokenHash = refreshTokenModel.hashToken(rawRefreshToken)

    const storedToken = await refreshTokenModel.findActiveByHash(tokenHash)
    if (!storedToken) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid refresh token")
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Refresh token has expired")
    }

    await refreshTokenModel.revokeById(storedToken.id)

    const user = await userModel.findOne({ id: userId })
    if (!user) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    const newAccessToken = generateAccessToken(userId)
    const newRefreshToken = generateRefreshToken(userId)

    const newTokenHash = refreshTokenModel.hashToken(newRefreshToken)
    const expiresAt = parseExpiresIn(process.env.REFRESH_TOKEN_EXPIRES_IN)
    await refreshTokenModel.create({
      user_id: userId,
      token_hash: newTokenHash,
      expires_at: expiresAt,
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/auth/logout — Revoke the current refresh token.
 * Idempotent: if no refresh token is provided or it's already revoked,
 * responds with success without error.
 *
 * @param {Object} req - Express request object (x-refresh-token header)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.headers["x-refresh-token"]
    if (rawRefreshToken) {
      const tokenHash = refreshTokenModel.hashToken(rawRefreshToken)
      const storedToken = await refreshTokenModel.findActiveByHash(tokenHash)
      if (storedToken) {
        await refreshTokenModel.revokeById(storedToken.id)
      }
    }

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: null,
      }),
    )
  } catch (error) {
    return next(error)
  }
}
