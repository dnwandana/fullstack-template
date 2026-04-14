import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js"
import logger from "../utils/logger.js"

/**
 * Express middleware to require a valid access token for protected routes.
 *
 * Validates the access token in the Authorization header and sets the user in the request object.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with error status and message
 */
export const requireAccessToken = (req, res, next) => {
  try {
    // get token from header
    const accessToken = req.headers["x-access-token"]
    if (!accessToken) {
      logger.warn("Authentication failed: No token provided", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "No token provided")
    }

    // verify token
    const decoded = verifyAccessToken(accessToken)

    if (decoded.type !== "access") {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid token type")
    }

    // set user in request
    req.user = { id: decoded.id }

    // Log successful authentication
    logger.debug("User authenticated successfully", {
      userId: decoded.id,
      method: req.method,
      url: req.url,
    })

    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.warn("Authentication failed: Invalid token", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      return next(new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid token"))
    }
    if (error.name === "TokenExpiredError") {
      logger.warn("Authentication failed: Token expired", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      return next(new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Token expired"))
    }
    logger.error("Authentication error", {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      ip: req.ip,
    })
    return next(error)
  }
}

/**
 * Express middleware to require a valid refresh token for protected routes.
 *
 * Validates the refresh token in the Authorization header.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with error status and message
 */
export const requireRefreshToken = (req, res, next) => {
  try {
    // get token from header
    const refreshToken = req.headers["x-refresh-token"]
    if (!refreshToken) {
      logger.warn("Refresh token authentication failed: No token provided", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "No token provided")
    }

    // verify token
    const decoded = verifyRefreshToken(refreshToken)

    if (decoded.type !== "refresh") {
      throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid token type")
    }

    // set user in request
    req.user = { id: decoded.id }

    // Log successful token refresh
    logger.debug("Refresh token verified successfully", {
      userId: decoded.id,
      method: req.method,
      url: req.url,
    })

    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.warn("Refresh token authentication failed: Invalid token", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      return next(new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid token"))
    }
    if (error.name === "TokenExpiredError") {
      logger.warn("Refresh token authentication failed: Token expired", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      })
      return next(new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Token expired"))
    }
    logger.error("Refresh token authentication error", {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      ip: req.ip,
    })
    return next(error)
  }
}
