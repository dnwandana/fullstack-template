import rateLimit from "express-rate-limit"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"

/**
 * Strict rate limiter for authentication endpoints (signup, signin, refresh).
 * Defaults to 10 requests per 15-minute window — configurable via RATE_LIMIT_AUTH_MAX.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(HTTP_STATUS_CODE.TOO_MANY_REQUESTS)
      .json(apiResponse({ message: "Too many requests, please try again later" }))
  },
})

/**
 * General rate limiter applied globally to all API routes.
 * Defaults to 100 requests per 15-minute window — configurable via RATE_LIMIT_GENERAL_MAX.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(HTTP_STATUS_CODE.TOO_MANY_REQUESTS)
      .json(apiResponse({ message: "Too many requests, please try again later" }))
  },
})
