import joi from "joi"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as userModel from "../models/users.js"
import { hashPassword, verifyPassword } from "../utils/argon2.js"
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js"
import crypto from "node:crypto"

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

export const signup = async (req, res, next) => {
  try {
    // validate request body
    const { error, value } = signupSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    // request values
    const { username, email, password } = value

    // check if user already exists by username
    const existingUser = await userModel.findOne({ username })
    if (existingUser) {
      throw new HttpError(
        HTTP_STATUS_CODE.BAD_REQUEST,
        "user with the given username already exists",
      )
    }

    // check for duplicate email if provided
    if (email) {
      const existingEmail = await userModel.findOne({ email })
      if (existingEmail) {
        throw new HttpError(
          HTTP_STATUS_CODE.BAD_REQUEST,
          "user with the given email already exists",
        )
      }
    }

    // hash password
    const hashedPassword = await hashPassword(password)

    // build user data — include email only if provided
    const userData = {
      id: crypto.randomUUID(),
      username,
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    }
    if (email) userData.email = email

    // create user
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

export const signin = async (req, res, next) => {
  try {
    // validate request body
    const { error, value } = signinSchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    // request values
    const { username, password } = value

    // Timing-safe credential check: always run verifyPassword to prevent
    // response-time differences from revealing whether a username exists.
    const user = await userModel.findOneWithPassword({ username })
    const hashToVerify = user?.password ?? dummyHash
    const isPasswordValid = await verifyPassword(hashToVerify, password)
    if (!user || !isPasswordValid) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    // generate tokens
    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

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

export const refreshAccessToken = async (req, res, next) => {
  try {
    // request values
    const userId = req.user.id

    // Verify the user still exists (reject refresh for deleted accounts)
    const user = await userModel.findOne({ id: userId })
    if (!user) {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "invalid credentials")
    }

    // generate new access token
    const accessToken = generateAccessToken(userId)

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: {
          access_token: accessToken,
        },
      }),
    )
  } catch (error) {
    return next(error)
  }
}
