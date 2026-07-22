import joi from "joi"
import crypto from "node:crypto"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as userModel from "../models/users.js"
import * as refreshTokenModel from "../models/refresh-tokens.js"
import * as invitationModel from "../models/invitations.js"
import db from "../config/database.js"
import logger from "../utils/logger.js"
import { hashPassword, verifyPassword } from "../utils/argon2.js"
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js"
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from "../utils/cookies.js"

// Pre-computed dummy hash for timing-safe signin.
// Ensures verifyPassword always runs, even when the user doesn't exist,
// so response times don't reveal whether an email is registered.
const dummyHash = await hashPassword("dummy-timing-safe-password")

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

const signupSchema = joi
  .object({
    name: joi
      .string()
      .trim()
      .min(1)
      .max(100)
      .pattern(/^[^\p{Cc}\p{Zl}\p{Zp}\u200E\u200F\u202A-\u202E\u2066-\u2069]+$/u)
      .required()
      .messages({
        "string.pattern.base": "name must not contain control characters",
      }),
    email: joi.string().trim().lowercase().email().max(255).required(),
    password: joi
      .string()
      .min(8)
      .max(72)
      .pattern(/[A-Z]/, "uppercase")
      .pattern(/[a-z]/, "lowercase")
      .pattern(/[0-9]/, "digit")
      .pattern(/[^A-Za-z0-9]/, "special")
      .required()
      .messages({
        "string.min": "password must be at least 8 characters",
        "string.max": "password must be at most 72 characters",
        "string.pattern.name.uppercase": "password must contain at least one uppercase letter",
        "string.pattern.name.lowercase": "password must contain at least one lowercase letter",
        "string.pattern.name.digit": "password must contain at least one digit",
        "string.pattern.name.special": "password must contain at least one special character",
      }),
    confirmation_password: joi.string().required().valid(joi.ref("password")).messages({
      "any.only": "confirmation_password must match password",
    }),
  })
  .options({ stripUnknown: true })

const signinSchema = joi
  .object({
    email: joi.string().trim().lowercase().email().max(255).required(),
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
 * Email must be unique; name is a display name and need not be unique.
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

    const { name, email, password } = value

    const existingEmail = await userModel.findOne({ email })
    if (existingEmail) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "user with the given email already exists")
    }

    const hashedPassword = await hashPassword(password)

    const userData = {
      id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    }

    let user
    try {
      ;[user] = await userModel.create(userData)
    } catch (err) {
      // 23505 = unique_violation — lost the race against a concurrent signup
      if (err.code === "23505") {
        throw new HttpError(
          HTTP_STATUS_CODE.BAD_REQUEST,
          "user with the given email already exists",
        )
      }
      throw err
    }

    // Link any invitations that were addressed to this email before the account
    // existed. Best-effort: the user row is already committed, so a failure here
    // must not turn a successful signup into a 500. The invitation stays
    // acceptable via its link either way — only in-app discovery degrades.
    try {
      await invitationModel.linkInviteeByEmail(email, user.id)
    } catch (backfillError) {
      // Swallowed by design, but not silently: the "controllers do not log"
      // convention exists to stop double-logging errors that errorHandler will
      // see. This one is deliberately not propagated, so this is its only
      // record — without it a broken backfill degrades invitation discovery
      // for every new user with no signal at all.
      logger.error("Invitation backfill failed at signup", {
        requestId: req.id,
        userId: user.id,
        email,
        error: backfillError.message,
      })
    }

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/auth/signin — Authenticate and obtain tokens.
 * Uses timing-safe credential checking to prevent email enumeration.
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

    const { email, password } = value

    const user = await userModel.findOneWithPassword({ email })
    const hashToVerify = user?.password ?? dummyHash
    const isPasswordValid = await verifyPassword(hashToVerify, password)

    // Check account lockout (only for existing users)
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    if (!user || !isPasswordValid) {
      // Increment failed login attempts for existing users
      if (user) {
        const [updated] = await userModel.incrementFailedAttempts(user.id)
        if (updated.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
          await db("users")
            .where({ id: user.id })
            .update({
              failed_login_attempts: 0,
              locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS),
            })
        }
      }
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    // Successful login — reset lockout fields
    await db("users")
      .where({ id: user.id })
      .update({ failed_login_attempts: 0, locked_until: null })

    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    const tokenHash = refreshTokenModel.hashToken(refreshToken)
    const expiresAt = parseExpiresIn(process.env.REFRESH_TOKEN_EXPIRES_IN)
    await refreshTokenModel.create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    setAccessTokenCookie(res, accessToken)
    setRefreshTokenCookie(res, refreshToken)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
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

    const rawRefreshToken = req.cookies?.refresh_token
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

    setAccessTokenCookie(res, newAccessToken)
    setRefreshTokenCookie(res, newRefreshToken)

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
    const rawRefreshToken = req.cookies?.refresh_token
    if (rawRefreshToken) {
      const tokenHash = refreshTokenModel.hashToken(rawRefreshToken)
      const storedToken = await refreshTokenModel.findActiveByHash(tokenHash)
      if (storedToken) {
        await refreshTokenModel.revokeById(storedToken.id)
      }
    }

    clearAuthCookies(res)

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

/**
 * GET /api/auth/me — Return the authenticated user's identity.
 * Used by the frontend to verify cookie validity on app startup.
 *
 * @param {Object} req - Express request object (req.user.id set by requireAccessToken middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await userModel.findOne({ id: req.user.id })
    if (!user) {
      throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "User not found")
    }
    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: { id: user.id, name: user.name, email: user.email },
      }),
    )
  } catch (error) {
    return next(error)
  }
}
